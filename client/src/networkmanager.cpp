#include "networkmanager.h"

#include <QNetworkRequest>
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrl>
#include <QTimer>
#include <QDateTime>
#include <QDebug>

NetworkManager::NetworkManager(QObject *parent)
    : QObject(parent)
    , m_networkManager(new QNetworkAccessManager(this))
    , m_webSocket(nullptr)
    , m_serverUrl("http://localhost:3000/api")
    , m_webSocketUrl("ws://localhost:3000")
    , m_pingThreshold(200)
{
}

void NetworkManager::login(const QString &username, const QString &password)
{
    QUrl url(m_serverUrl + "/auth/login");
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    
    QJsonObject body;
    body["username"] = username;
    body["password"] = password;
    
    QNetworkReply *reply = m_networkManager->post(request, QJsonDocument(body).toJson());
    connect(reply, &QNetworkReply::finished, this, &NetworkManager::onLoginFinished);
}

void NetworkManager::onLoginFinished()
{
    QNetworkReply *reply = qobject_cast<QNetworkReply *>(sender());
    if (!reply) return;
    
    if (reply->error() == QNetworkReply::NoError) {
        QByteArray data = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        QJsonObject json = doc.object();
        
        QString token = json["token"].toString();
        QJsonObject userInfo = json["user"].toObject();
        
        emit loginSuccess(token, userInfo);
    } else {
        QByteArray data = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        QJsonObject json = doc.object();
        
        QString error = json["message"].toString();
        if (error.isEmpty()) {
            error = json["error"].toString();
        }
        
        // Check if user is blocked
        if (json["blockReason"].isString()) {
            QString blockMessage = json["message"].toString();
            if (blockMessage.isEmpty()) {
                blockMessage = "Siz klaviaturadan ko'p foydalandingiz va bloklandingiz. Adminga murojaat qiling";
            }
            emit blockReceived(json["blockReason"].toString(), blockMessage);
        } else {
            emit loginFailed(error.isEmpty() ? "Login failed" : error);
        }
    }
    
    reply->deleteLater();
}

void NetworkManager::fetchSubjects(const QString &token)
{
    QUrl url(m_serverUrl + "/subjects");
    QNetworkRequest request(url);
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    
    QNetworkReply *reply = m_networkManager->get(request);
    connect(reply, &QNetworkReply::finished, this, &NetworkManager::onSubjectsFinished);
}

void NetworkManager::onSubjectsFinished()
{
    QNetworkReply *reply = qobject_cast<QNetworkReply *>(sender());
    if (!reply) return;
    
    if (reply->error() == QNetworkReply::NoError) {
        QByteArray data = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        QJsonArray subjects = doc.array();
        
        emit subjectsFetched(subjects);
    } else {
        qDebug() << "Fetch subjects error:" << reply->errorString();
    }
    
    reply->deleteLater();
}

void NetworkManager::fetchQuestions(const QString &token, const QString &subjectId)
{
    QUrl url(m_serverUrl + "/test/questions?subjectId=" + subjectId);
    QNetworkRequest request(url);
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    
    QNetworkReply *reply = m_networkManager->get(request);
    connect(reply, &QNetworkReply::finished, this, &NetworkManager::onQuestionsFinished);
}

void NetworkManager::onQuestionsFinished()
{
    QNetworkReply *reply = qobject_cast<QNetworkReply *>(sender());
    if (!reply) return;
    
    if (reply->error() == QNetworkReply::NoError) {
        QByteArray data = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        QJsonObject testData = doc.object();
        
        emit questionsFetched(testData);
    } else {
        QByteArray data = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        QJsonObject json = doc.object();
        
        QString error = json["error"].toString();
        qDebug() << "Fetch questions error:" << error;
        
        // Check for 409 Conflict (test already in progress)
        if (reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 409) {
            emit loginFailed("Test already in progress");
        }
    }
    
    reply->deleteLater();
}

void NetworkManager::submitAnswers(const QString &token, const QString &sessionId, const QJsonArray &answers)
{
    QUrl url(m_serverUrl + "/test/submit");
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    
    QJsonObject body;
    body["sessionId"] = sessionId;
    body["answers"] = answers;
    
    QNetworkReply *reply = m_networkManager->post(request, QJsonDocument(body).toJson());
    connect(reply, &QNetworkReply::finished, this, &NetworkManager::onSubmitFinished);
}

void NetworkManager::onSubmitFinished()
{
    QNetworkReply *reply = qobject_cast<QNetworkReply *>(sender());
    if (!reply) return;
    
    if (reply->error() == QNetworkReply::NoError) {
        QByteArray data = reply->readAll();
        QJsonDocument doc = QJsonDocument::fromJson(data);
        QJsonObject results = doc.object();
        
        emit answersSubmitted(results);
    } else {
        qDebug() << "Submit answers error:" << reply->errorString();
    }
    
    reply->deleteLater();
}

void NetworkManager::checkInternetSpeed(std::function<void(bool)> callback)
{
    m_speedCheckCallback = callback;
    
    QUrl url(m_serverUrl + "/ping");
    QNetworkRequest request(url);
    
    m_pingStart = QDateTime::currentMSecsSinceEpoch();
    QNetworkReply *reply = m_networkManager->get(request);
    connect(reply, &QNetworkReply::finished, this, &NetworkManager::onPingFinished);
}

void NetworkManager::onPingFinished()
{
    QNetworkReply *reply = qobject_cast<QNetworkReply *>(sender());
    if (!reply) return;
    
    qint64 latency = QDateTime::currentMSecsSinceEpoch() - m_pingStart;
    
    bool isFastEnough = (latency <= m_pingThreshold);
    
    if (m_speedCheckCallback) {
        m_speedCheckCallback(isFastEnough);
    }
    
    if (!isFastEnough) {
        emit internetSpeedLow();
    }
    
    reply->deleteLater();
}

void NetworkManager::reportInterruption(const QString &token, const QString &reason, const QString &description)
{
    QUrl url(m_serverUrl + "/test/report-interruption");
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    
    QJsonObject body;
    body["reason"] = reason;
    body["description"] = description;
    
    // Fire and forget - don't wait for response
    QNetworkReply *reply = m_networkManager->post(request, QJsonDocument(body).toJson());
    reply->deleteLater();
}

void NetworkManager::sendHeartbeat(const QString &token)
{
    QUrl url(m_serverUrl + "/test/heartbeat");
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    
    QNetworkReply *reply = m_networkManager->post(request, QByteArray());
    connect(reply, &QNetworkReply::finished, [reply]() {
        if (reply->error() != QNetworkReply::NoError) {
            qDebug() << "Heartbeat failed:" << reply->errorString();
        }
        reply->deleteLater();
    });
}

void NetworkManager::connectWebSocket(const QString &userId, const QString &token)
{
    if (m_webSocket) {
        m_webSocket->deleteLater();
    }
    
    m_webSocket = new QWebSocket();
    
    connect(m_webSocket, &QWebSocket::connected, this, &NetworkManager::onWebSocketConnected);
    connect(m_webSocket, &QWebSocket::disconnected, this, &NetworkManager::onWebSocketDisconnected);
    connect(m_webSocket, QOverload<QAbstractSocket::SocketError>::of(&QWebSocket::error),
            this, &NetworkManager::onWebSocketError);
    connect(m_webSocket, &QWebSocket::textMessageReceived,
            this, &NetworkManager::onWebSocketMessageReceived);
    
    m_webSocket->open(QUrl(m_webSocketUrl));
}

void NetworkManager::onWebSocketConnected()
{
    qDebug() << "WebSocket connected";
    
    // Send auth message
    QJsonObject authMsg;
    authMsg["type"] = "auth";
    // In a real implementation, include userId and token
    // authMsg["userId"] = userId;
    // authMsg["token"] = token;
    
    m_webSocket->sendTextMessage(QString::fromUtf8(QJsonDocument(authMsg).toJson()));
}

void NetworkManager::onWebSocketDisconnected()
{
    qDebug() << "WebSocket disconnected";
    emit connectionLost();
}

void NetworkManager::onWebSocketError(QAbstractSocket::SocketError error)
{
    qDebug() << "WebSocket error:" << error;
    emit connectionLost();
}

void NetworkManager::onWebSocketMessageReceived(const QString &message)
{
    QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
    QJsonObject json = doc.object();
    
    QString type = json["type"].toString();
    
    if (type == "blocked") {
        emit blockReceived(json["reason"].toString(), json["message"].toString());
    }
}

void NetworkManager::sendKeyPress()
{
    if (m_webSocket && m_webSocket->isValid()) {
        QJsonObject msg;
        msg["type"] = "keypress";
        m_webSocket->sendTextMessage(QString::fromUtf8(QJsonDocument(msg).toJson()));
    }
}

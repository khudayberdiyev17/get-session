#ifndef NETWORKMANAGER_H
#define NETWORKMANAGER_H

#include <QObject>
#include <QString>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QWebSocket>
#include <functional>

class NetworkManager : public QObject
{
    Q_OBJECT

public:
    explicit NetworkManager(QObject *parent = nullptr);
    
    void login(const QString &username, const QString &password);
    void fetchSubjects(const QString &token);
    void fetchQuestions(const QString &token, const QString &subjectId);
    void submitAnswers(const QString &token, const QString &sessionId, const QJsonArray &answers);
    void checkInternetSpeed(std::function<void(bool)> callback);
    void reportInterruption(const QString &token, const QString &reason, const QString &description);
    void sendHeartbeat(const QString &token);
    
    void connectWebSocket(const QString &userId, const QString &token);
    void sendKeyPress();

signals:
    void loginSuccess(const QString &token, const QJsonObject &userInfo);
    void loginFailed(const QString &error);
    void subjectsFetched(const QJsonArray &subjects);
    void questionsFetched(const QJsonObject &testData);
    void answersSubmitted(const QJsonObject &results);
    void internetSpeedLow();
    void connectionLost();
    void blockReceived(const QString &reason, const QString &message);

private slots:
    void onLoginFinished();
    void onSubjectsFinished();
    void onQuestionsFinished();
    void onSubmitFinished();
    void onPingFinished();
    void onWebSocketConnected();
    void onWebSocketDisconnected();
    void onWebSocketError(QAbstractSocket::SocketError error);
    void onWebSocketMessageReceived(const QString &message);

private:
    QNetworkAccessManager *m_networkManager;
    QWebSocket *m_webSocket;
    
    QString m_serverUrl;
    QString m_webSocketUrl;
    int m_pingThreshold;
    
    std::function<void(bool)> m_speedCheckCallback;
};

#endif // NETWORKMANAGER_H

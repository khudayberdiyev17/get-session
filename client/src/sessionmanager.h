#ifndef SESSIONMANAGER_H
#define SESSIONMANAGER_H

#include <QObject>
#include <QString>
#include <QJsonObject>
#include <QTimer>

class SessionManager : public QObject
{
    Q_OBJECT

public:
    explicit SessionManager(QObject *parent = nullptr);
    
    void setAuthToken(const QString &token);
    void setUserInfo(const QJsonObject &userInfo);
    void clear();
    
    QString authToken() const { return m_authToken; }
    QJsonObject userInfo() const { return m_userInfo; }
    
    void startHeartbeat();
    void stopHeartbeat();

private slots:
    void onHeartbeatTimeout();

private:
    QString m_authToken;
    QJsonObject m_userInfo;
    QTimer *m_heartbeatTimer;
};

#endif // SESSIONMANAGER_H

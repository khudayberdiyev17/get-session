#include "sessionmanager.h"

SessionManager::SessionManager(QObject *parent)
    : QObject(parent)
    , m_heartbeatTimer(new QTimer(this))
{
    connect(m_heartbeatTimer, &QTimer::timeout, this, &SessionManager::onHeartbeatTimeout);
}

void SessionManager::setAuthToken(const QString &token)
{
    m_authToken = token;
}

void SessionManager::setUserInfo(const QJsonObject &userInfo)
{
    m_userInfo = userInfo;
}

void SessionManager::clear()
{
    m_authToken.clear();
    m_userInfo = QJsonObject();
    stopHeartbeat();
}

void SessionManager::startHeartbeat()
{
    // Send heartbeat every 10 seconds
    m_heartbeatTimer->start(10000);
}

void SessionManager::stopHeartbeat()
{
    m_heartbeatTimer->stop();
}

void SessionManager::onHeartbeatTimeout()
{
    // In a real implementation, send heartbeat to server
    // This would require access to NetworkManager
    // For now, just a placeholder
}

#ifndef LOGINWIDGET_H
#define LOGINWIDGET_H

#include <QWidget>
#include <QString>
#include <QJsonObject>

class QLineEdit;
class QPushButton;
class QLabel;
class QVBoxLayout;
class NetworkManager;

class LoginWidget : public QWidget
{
    Q_OBJECT

public:
    explicit LoginWidget(QWidget *parent = nullptr);

signals:
    void loginSuccess(const QString &token, const QJsonObject &userInfo);
    void logout();

private slots:
    void attemptLogin();
    void onLoginFailed(const QString &error);

private:
    void setupUI();

    QLineEdit *m_usernameEdit;
    QLineEdit *m_passwordEdit;
    QPushButton *m_loginButton;
    QLabel *m_errorLabel;
    QLabel *m_titleLabel;
    
    NetworkManager *m_networkManager;
};

#endif // LOGINWIDGET_H

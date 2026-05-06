#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QStackedWidget>
#include <QString>
#include <QJsonObject>

class LoginWidget;
class SubjectSelectionWidget;
class TestWidget;
class ReportWidget;
class NetworkManager;
class SessionManager;
class KeyboardEventFilter;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

protected:
    void closeEvent(QCloseEvent *event) override;
    void keyPressEvent(QKeyEvent *event) override;

private slots:
    void onLoginSuccess(const QString &token, const QJsonObject &userInfo);
    void onLogout();
    void onSubjectSelected(const QString &subjectId, int totalTimeLimit);
    void onTestStarted(const QJsonObject &testData);
    void onTestFinished(const QJsonObject &results);
    void onBlockReceived(const QString &reason, const QString &message);
    void onInternetSpeedLow();
    void onConnectionLost();

private:
    void setupUI();
    void setupConnections();
    void showLogin();
    void showSubjectSelection();
    void showTest();
    void showReport(const QJsonObject &results);
    void checkActiveSession();

    QStackedWidget *m_stackedWidget;
    LoginWidget *m_loginWidget;
    SubjectSelectionWidget *m_subjectSelectionWidget;
    TestWidget *m_testWidget;
    ReportWidget *m_reportWidget;

    NetworkManager *m_networkManager;
    SessionManager *m_sessionManager;
    KeyboardEventFilter *m_keyboardFilter;

    QString m_authToken;
    QJsonObject m_userInfo;
    bool m_isTestActive;
};

#endif // MAINWINDOW_H

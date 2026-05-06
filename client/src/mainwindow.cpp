#include "mainwindow.h"
#include "loginwidget.h"
#include "subjectselectionwidget.h"
#include "testwidget.h"
#include "reportwidget.h"
#include "networkmanager.h"
#include "sessionmanager.h"
#include "keyboardeventfilter.h"

#include <QApplication>
#include <QCloseEvent>
#include <QKeyEvent>
#include <QMessageBox>
#include <QScreen>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_stackedWidget(nullptr)
    , m_loginWidget(nullptr)
    , m_subjectSelectionWidget(nullptr)
    , m_testWidget(nullptr)
    , m_reportWidget(nullptr)
    , m_networkManager(nullptr)
    , m_sessionManager(nullptr)
    , m_keyboardFilter(nullptr)
    , m_isTestActive(false)
{
    // Initialize managers
    m_networkManager = new NetworkManager(this);
    m_sessionManager = new SessionManager(this);
    
    // Setup keyboard filter
    m_keyboardFilter = new KeyboardEventFilter(this);
    
    setupUI();
    setupConnections();
    
    // Force full-screen mode
    setWindowState(Qt::WindowFullScreen);
    setWindowFlags(windowFlags() | Qt::FramelessWindowHint);
    showFullScreen();
    
    // Show login screen
    showLogin();
}

MainWindow::~MainWindow()
{
}

void MainWindow::setupUI()
{
    setWindowTitle("Exam System Client");
    setMinimumSize(1024, 768);
    
    m_stackedWidget = new QStackedWidget(this);
    setCentralWidget(m_stackedWidget);
    
    m_loginWidget = new LoginWidget(this);
    m_subjectSelectionWidget = new SubjectSelectionWidget(this);
    m_testWidget = new TestWidget(this);
    m_reportWidget = new ReportWidget(this);
    
    m_stackedWidget->addWidget(m_loginWidget);
    m_stackedWidget->addWidget(m_subjectSelectionWidget);
    m_stackedWidget->addWidget(m_testWidget);
    m_stackedWidget->addWidget(m_reportWidget);
}

void MainWindow::setupConnections()
{
    // Login widget connections
    connect(m_loginWidget, &LoginWidget::loginSuccess,
            this, &MainWindow::onLoginSuccess);
    connect(m_loginWidget, &LoginWidget::logout,
            this, &MainWindow::onLogout);
    
    // Subject selection connections
    connect(m_subjectSelectionWidget, &SubjectSelectionWidget::subjectSelected,
            this, &MainWindow::onSubjectSelected);
    
    // Test widget connections
    connect(m_testWidget, &TestWidget::testStarted,
            this, &MainWindow::onTestStarted);
    connect(m_testWidget, &TestWidget::testFinished,
            this, &MainWindow::onTestFinished);
    connect(m_testWidget, &TestWidget::blockReceived,
            this, &MainWindow::onBlockReceived);
    
    // Network manager connections
    connect(m_networkManager, &NetworkManager::internetSpeedLow,
            this, &MainWindow::onInternetSpeedLow);
    connect(m_networkManager, &NetworkManager::connectionLost,
            this, &MainWindow::onConnectionLost);
    connect(m_networkManager, &NetworkManager::blockReceived,
            this, &MainWindow::onBlockReceived);
    
    // Install keyboard filter on test widget
    m_testWidget->installEventFilter(m_keyboardFilter);
}

void MainWindow::showLogin()
{
    m_stackedWidget->setCurrentWidget(m_loginWidget);
    setWindowState(Qt::WindowFullScreen);
}

void MainWindow::showSubjectSelection()
{
    m_stackedWidget->setCurrentWidget(m_subjectSelectionWidget);
    m_subjectSelectionWidget->loadSubjects(m_authToken);
    setWindowState(Qt::WindowFullScreen);
}

void MainWindow::showTest()
{
    m_stackedWidget->setCurrentWidget(m_testWidget);
    setWindowState(Qt::WindowFullScreen);
}

void MainWindow::showReport(const QJsonObject &results)
{
    m_reportWidget->displayResults(results);
    m_stackedWidget->setCurrentWidget(m_reportWidget);
    setWindowState(Qt::WindowFullScreen);
}

void MainWindow::onLoginSuccess(const QString &token, const QJsonObject &userInfo)
{
    m_authToken = token;
    m_userInfo = userInfo;
    m_sessionManager->setAuthToken(token);
    m_sessionManager->setUserInfo(userInfo);
    
    showSubjectSelection();
}

void MainWindow::onLogout()
{
    m_authToken.clear();
    m_userInfo = QJsonObject();
    m_sessionManager->clear();
    m_isTestActive = false;
    
    showLogin();
}

void MainWindow::onSubjectSelected(const QString &subjectId, int totalTimeLimit)
{
    m_isTestActive = true;
    m_networkManager->checkInternetSpeed([this](bool isFastEnough) {
        if (isFastEnough) {
            m_networkManager->fetchQuestions(m_authToken, subjectId);
        } else {
            onInternetSpeedLow();
        }
    });
}

void MainWindow::onTestStarted(const QJsonObject &testData)
{
    m_testWidget->startTest(testData);
    showTest();
}

void MainWindow::onTestFinished(const QJsonObject &results)
{
    m_isTestActive = false;
    showReport(results);
}

void MainWindow::onBlockReceived(const QString &reason, const QString &message)
{
    m_isTestActive = false;
    
    QMessageBox::critical(this, "Blocked", message);
    
    m_authToken.clear();
    m_userInfo = QJsonObject();
    m_sessionManager->clear();
    
    showLogin();
}

void MainWindow::onInternetSpeedLow()
{
    QMessageBox::warning(this, "Internet Speed Warning",
        "Internet tezligi past. Boshqa WIFI ga ulaning yoki Modemni qayta o'chirib yoqing!");
}

void MainWindow::onConnectionLost()
{
    if (m_isTestActive) {
        QMessageBox::critical(this, "Connection Lost",
            "Test interrupted – internet lost or PC powered off.\n\nContact admin to unblock.");
        onLogout();
    }
}

void MainWindow::closeEvent(QCloseEvent *event)
{
    if (m_isTestActive) {
        // Prevent closing during test
        event->ignore();
        
        // Report interruption to server
        m_networkManager->reportInterruption(m_authToken, "pc_shutdown", "User attempted to close application during test");
        
        QMessageBox::critical(this, "Cannot Exit",
            "You cannot exit during an active test!\n\nAttempting to close will block your account.");
    } else {
        event->accept();
    }
}

void MainWindow::keyPressEvent(QKeyEvent *event)
{
    // Handle global shortcuts
    if (event->key() == Qt::Key_F11) {
        // Toggle fullscreen (for debugging only)
        if (isFullScreen()) {
            showNormal();
        } else {
            showFullScreen();
        }
        return;
    }
    
    // Pass key events to current widget
    QWidget::keyPressEvent(event);
}

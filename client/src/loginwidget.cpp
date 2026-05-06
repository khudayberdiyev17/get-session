#include "loginwidget.h"
#include "networkmanager.h"

#include <QLineEdit>
#include <QPushButton>
#include <QLabel>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFrame>
#include <QMessageBox>

LoginWidget::LoginWidget(QWidget *parent)
    : QWidget(parent)
    , m_usernameEdit(nullptr)
    , m_passwordEdit(nullptr)
    , m_loginButton(nullptr)
    , m_errorLabel(nullptr)
    , m_titleLabel(nullptr)
    , m_networkManager(nullptr)
{
    m_networkManager = new NetworkManager(this);
    
    setupUI();
    
    connect(m_networkManager, &NetworkManager::loginSuccess,
            this, &LoginWidget::loginSuccess);
    connect(m_networkManager, &NetworkManager::loginFailed,
            this, &LoginWidget::onLoginFailed);
}

void LoginWidget::setupUI()
{
    setStyleSheet(R"(
        QWidget {
            background-color: #f0f4f8;
        }
        QFrame {
            background-color: white;
            border-radius: 10px;
        }
        QLabel#title {
            font-size: 32px;
            font-weight: bold;
            color: #1a202c;
        }
        QLabel#subtitle {
            font-size: 16px;
            color: #718096;
        }
        QLabel#error {
            color: #e53e3e;
            font-size: 14px;
        }
        QLineEdit {
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 6px;
            font-size: 16px;
            background-color: white;
        }
        QLineEdit:focus {
            border-color: #4299e1;
        }
        QPushButton {
            background-color: #4299e1;
            color: white;
            font-size: 16px;
            font-weight: bold;
            padding: 12px 24px;
            border-radius: 6px;
        }
        QPushButton:hover {
            background-color: #3182ce;
        }
        QPushButton:pressed {
            background-color: #2b6cb0;
        }
    )");

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setAlignment(Qt::AlignCenter);

    // Create centered frame
    auto *frame = new QFrame();
    frame->setObjectName("loginFrame");
    frame->setFixedWidth(400);
    frame->setContentsMargins(40, 40, 40, 40);
    
    auto *frameLayout = new QVBoxLayout(frame);
    frameLayout->setSpacing(20);

    // Title
    m_titleLabel = new QLabel("Exam System");
    m_titleLabel->setObjectName("title");
    m_titleLabel->setAlignment(Qt::AlignCenter);
    frameLayout->addWidget(m_titleLabel);

    // Subtitle
    auto *subtitleLabel = new QLabel("Student Login");
    subtitleLabel->setObjectName("subtitle");
    subtitleLabel->setAlignment(Qt::AlignCenter);
    frameLayout->addWidget(subtitleLabel);

    frameLayout->addSpacing(20);

    // Username field
    auto *usernameLabel = new QLabel("Username");
    usernameLabel->setStyleSheet("font-weight: bold; color: #2d3748;");
    frameLayout->addWidget(usernameLabel);

    m_usernameEdit = new QLineEdit();
    m_usernameEdit->setPlaceholderText("Enter your username");
    m_usernameEdit->setClearButtonEnabled(true);
    frameLayout->addWidget(m_usernameEdit);

    // Password field
    auto *passwordLabel = new QLabel("Password");
    passwordLabel->setStyleSheet("font-weight: bold; color: #2d3748;");
    frameLayout->addWidget(passwordLabel);

    m_passwordEdit = new QLineEdit();
    m_passwordEdit->setPlaceholderText("Enter your password");
    m_passwordEdit->setEchoMode(QLineEdit::Password);
    m_passwordEdit->setClearButtonEnabled(true);
    frameLayout->addWidget(m_passwordEdit);

    // Error label
    m_errorLabel = new QLabel();
    m_errorLabel->setObjectName("error");
    m_errorLabel->setWordWrap(true);
    m_errorLabel->hide();
    frameLayout->addWidget(m_errorLabel);

    frameLayout->addSpacing(10);

    // Login button
    m_loginButton = new QPushButton("Login");
    m_loginButton->setFixedHeight(50);
    frameLayout->addWidget(m_loginButton);

    mainLayout->addWidget(frame);

    // Connect signals
    connect(m_loginButton, &QPushButton::clicked, this, &LoginWidget::attemptLogin);
    connect(m_passwordEdit, &QLineEdit::returnPressed, this, &LoginWidget::attemptLogin);
}

void LoginWidget::attemptLogin()
{
    QString username = m_usernameEdit->text().trimmed();
    QString password = m_passwordEdit->text();

    if (username.isEmpty() || password.isEmpty()) {
        m_errorLabel->setText("Please enter both username and password");
        m_errorLabel->show();
        return;
    }

    m_errorLabel->hide();
    m_loginButton->setEnabled(false);
    m_loginButton->setText("Logging in...");

    m_networkManager->login(username, password);
}

void LoginWidget::onLoginFailed(const QString &error)
{
    m_errorLabel->setText(error);
    m_errorLabel->show();
    m_loginButton->setEnabled(true);
    m_loginButton->setText("Login");
}

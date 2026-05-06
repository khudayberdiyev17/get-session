#ifndef SUBJECTSELECTIONWIDGET_H
#define SUBJECTSELECTIONWIDGET_H

#include <QWidget>
#include <QString>
#include <QJsonArray>

class QVBoxLayout;
class QLabel;
class QScrollArea;
class NetworkManager;

class SubjectSelectionWidget : public QWidget
{
    Q_OBJECT

public:
    explicit SubjectSelectionWidget(QWidget *parent = nullptr);

signals:
    void subjectSelected(const QString &subjectId, int totalTimeLimit);

private slots:
    void onSubjectsLoaded(const QJsonArray &subjects);
    void onSubjectClicked(const QString &subjectId, int totalTimeLimit);

private:
    void setupUI();
    void loadSubjects(const QString &token);
    void displaySubjects(const QJsonArray &subjects);

    QVBoxLayout *m_mainLayout;
    QScrollArea *m_scrollArea;
    QWidget *m_scrollContent;
    QLabel *m_titleLabel;
    
    NetworkManager *m_networkManager;
};

#endif // SUBJECTSELECTIONWIDGET_H

#ifndef KEYBOARDEVENTFILTER_H
#define KEYBOARDEVENTFILTER_H

#include <QObject>
#include <QEvent>
#include <QKeyEvent>

class KeyboardEventFilter : public QObject
{
    Q_OBJECT

public:
    explicit KeyboardEventFilter(QObject *parent = nullptr);

signals:
    void allowedKeyPressed(Qt::Key key);
    void disallowedKeyPressed();

protected:
    bool eventFilter(QObject *obj, QEvent *event) override;

private:
    bool isAllowedKey(Qt::Key key) const;
};

#endif // KEYBOARDEVENTFILTER_H

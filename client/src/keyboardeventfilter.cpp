#include "keyboardeventfilter.h"

#include <QKeyEvent>

KeyboardEventFilter::KeyboardEventFilter(QObject *parent)
    : QObject(parent)
{
}

bool KeyboardEventFilter::eventFilter(QObject *obj, QEvent *event)
{
    if (event->type() == QEvent::KeyPress) {
        QKeyEvent *keyEvent = static_cast<QKeyEvent *>(event);
        Qt::Key key = static_cast<Qt::Key>(keyEvent->key());
        
        // Check if this is an allowed key
        if (isAllowedKey(key)) {
            emit allowedKeyPressed(key);
            // Allow the event to propagate
            return false;
        } else {
            // Block all other keys
            emit disallowedKeyPressed();
            return true; // Event filtered out
        }
    }
    
    // For all other events, use default processing
    return QObject::eventFilter(obj, event);
}

bool KeyboardEventFilter::isAllowedKey(Qt::Key key) const
{
    // Only allow navigation keys and Enter
    switch (key) {
        case Qt::Key_Left:
        case Qt::Key_Right:
        case Qt::Key_Up:
        case Qt::Key_Down:
        case Qt::Key_Enter:
        case Qt::Key_Return:
            return true;
        default:
            return false;
    }
}

cmake_minimum_required(VERSION 3.16)
project(ExamClient VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Qt packages
find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets Network WebSockets)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# Source files
set(SOURCES
    src/main.cpp
    src/mainwindow.cpp
    src/loginwidget.cpp
    src/subjectselectionwidget.cpp
    src/testwidget.cpp
    src/reportwidget.cpp
    src/networkmanager.cpp
    src/keyboardeventfilter.cpp
    src/sessionmanager.cpp
)

# Header files
set(HEADERS
    src/mainwindow.h
    src/loginwidget.h
    src/subjectselectionwidget.h
    src/testwidget.h
    src/reportwidget.h
    src/networkmanager.h
    src/keyboardeventfilter.h
    src/sessionmanager.h
)

# Create executable
add_executable(${PROJECT_NAME} WIN32
    ${SOURCES}
    ${HEADERS}
    resources/resources.qrc
)

# Link libraries
target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Network
    Qt6::WebSockets
)

# Windows-specific settings
if(WIN32)
    set_target_properties(${PROJECT_NAME} PROPERTIES
        WIN32_EXECUTABLE TRUE
    )
endif()

# Install rules
install(TARGETS ${PROJECT_NAME}
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

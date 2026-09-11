Created by 邬建川 on 五月 14, 2024

YDBRD-26617   支持DBMS_SESSION高级包

##   [1. 总述](#1-总述)  

Oracle的    `DBMS_SESSION`    包提供给用户一个用来管理数据库会话细节的接口。包含有一系列过程和函数，允许用户清理上下文、设置或清除用户标识符等。通过    `DBMS_SESSION`    可以有效地管理会话级别的状态，适用于需要精细管理会话信息的场景。

###   [1.1 需求合理性分析](#11-需求合理性分析)  

调用context相关的procedure前，需要用户进行context的创建，需要create context的支持

- **CLEAR_ALL_CONTEXT**  : 清除会话中所有的context。
- **CLEAR_CONTEXT**  : 清除指定的context。
- **CLEAR_IDENTIFIER**  : 清除会话的标识符。
- **SET_CONTEXT**  : 允许设置会话上下文中的值。其实就是为每个context新增或者修改 attr/value 键值对
- **SET_IDENTIFIER**  : 设置会话的标识符，有助于跟踪和管理用户会话。
- **free_unused_user_memory**  : 释放会话中未使用的用户内存。这个功能对于oracle管理内存资源非常重要，可以帮助避免内存泄露问题。


###   [1.2 需求实现分析](#12-需求实现分析)  

-   `SET_IDENTIFIER`     和     `CLEAR_IDENTIFIER`     只需要为会话增加一个字段即可
-   `FREE_UNUSED_USER_MEMORY`     在oracle中的作用主要是：


1.清除pl/sql的indexed table占用的内存。

2.清除为 sort等操作分配的内存

而在yashandb中 ：

1. pl/sql的indexed table的内存 使用的是appmemory 在执行结束后会自动释放。并且因为appmemory在执行阶段各个调用点都可能用到，不能在执行间进行清除
1. 相应操作不会存在执行后未释放的内存。


因此在yashandb总 FREE_UNUSED_USER_MEMORY仅需进行兼容性支持，无实际作用

-   `SET_CONTEXT`    ,     `CLEAR_CONTEXT`    ,     `CLEAR_ALL_CONTEXT`     需要CREATE CONTEXT作为支持


context有几种可创建的类型，对于不同的类型的context 进行     `SET_CONTEXT`     表现与内部实现也有区别

调研oceanbase的代码见：

- 对于accessed globally类型context的attr，是统一保存在一张系统表里
- 对于其他类型context的attr，则保存在会话对象的一个哈希表类型对象中


考虑到CREATE CONTEXT需要的开发工作量超过当前的安排，需进行需求变更，  **本sr不支持这三个procedure**

###   [1.3 数据字典](#13-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|  `DBMS_SESSION`  |Oracle提供的包，用于会话管理|是|Oracle官方文档|


###   [1.4 开源依赖](#14-开源依赖)  

无

##   [2. 接口](#2-接口)  

###   [高级包DBMS_SESSION:](#高级包dbms-session)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|过程|  `CLEAR_ALL_CONTEXT`  |清除会话中所有的上下文|是|
|过程|  `CLEAR_CONTEXT`  |清除指定的上下文名称空间|是|
|过程|  `SET_CONTEXT`  |设置会话上下文中的值|是|
|过程|  `SET_IDENTIFIER`  |设置会话标识符|是|
|过程|  `CLEAR_IDENTIFIER`  |清楚会话标识符|是|
|过程|  `free_unused_user_memory`  |释放会话中未使用的用户内存|是|


##   [3. 规格与约束](#3-规格与约束)  

**context相关的规格**

create context 有 initialized globally/externally 和 accessed globally 三种类型

**使用 set_context 为对应context 添加新的 attr**  ：

- 对于默认类型的context： attr仅在当前会话可见，且会话断开后，attr也一并被清除
- 对于accessed globally的context: attr全局可见，且会话断开后，attr仍然存在


##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

无
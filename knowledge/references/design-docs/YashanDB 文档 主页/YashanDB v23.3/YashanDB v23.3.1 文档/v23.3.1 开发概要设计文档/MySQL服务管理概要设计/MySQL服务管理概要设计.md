Created by 张鹏飞, last modified on 六月 14, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f8](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f8)    *?*    
  *#YASHAN-936 【mysql兼容】（mysql兼容框架）mysql服务管理*

  


##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

YashanDB在市场推广阶段，面向的客户群体中有大量存量业务，需要将底层数据库替换成YashanDB。由于用户的存量业务中用到的SQL语法、驱动、工具与之前使用的数据库可能存在深度绑定。本需求是为了在YashanDB中运行MySQL兼容模式，从而解决面向MySQL生态的协议、视图、数据类型、语法兼容问题。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

本需求旨在从架构上达到以下目标：

- 协议兼容 支持其他数据库的通信协议，用户可用其他数据库的驱动，及基于这些驱动开发的工具直连YashanDB
- SQL兼容 支持其他数据库的SQL方言，包括特有的SQL命令，以及特有的SQL语法分支
- 数据类型 兼容其他数据库的数据类型
- 系统视图兼容 支持其他数据库的常用系统视图


###   [1.5 开源依赖](#15-开源依赖)  

MySQL为开源软件（GPL协议），但本需求中涉及的数据类型、语法均为自研，不引入开源依赖。系统视图为MySQL的接口，本需求的视图实现与MySQL仅保持接口相同，不依赖MySQL的实现。通信协议由YashanDB团队实现，未引入MySQL组件。

因此，本需求不涉及开源依赖。

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

###   [4.1 MySQL兼容服务](#41-mysql兼容服务)  

通过Plugin Service方式启动MySQL兼容服务。    [Plugin Service架构](https://conf.yasdb.com/pages/viewpage.action?pageId=141579751#21-%E5%8D%8F%E8%AE%AE%E5%85%BC%E5%AE%B9)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e1e8970c2af4f5216b3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA1NzksImV4cCI6MTc4MjM4MTM3OX0.1of1C3aeaajYpLNCmCnW7kJpeZ81QQJXiA1Lb5zJ0Mw)

####   [4.1.1 Plugin Service服务注册](#411-plugin-service服务注册)  

允许用户在配置Plugin Service，在实例启动时，由YashanDB启动Plugin Service并提供相应服务。

####   [4.1.2 Plugin Service线程管理](#412-plugin-service线程管理)  

Plugin Service需要在yasdb进程内，启动一个服务线程（监听线程）。用户发起的MySQL连接请求到达服务线程后，服务线程会为连接请求分配一个工作线程，用于处理该连接的后续请求。

线程与用户连接的关系分为独占模式和共享模式（线程池）。

####   [4.1.3 会话管理](#413-会话管理)  

同YashanDB一样，每个MySQL的连接，会占用一个会话。yasdb进程可以像管理通过YashanDB协议连接的会话一样，管理MySQL协议连接的会话。包括但不限于以下场景：

- 通过v$session等视图查看会话状态
- kill session
- 通过设置最大连接数，限制YashanDB会话和MySQL会话的总数


###   [4.2 MySQL兼容模式会话](#42-mysql兼容模式会话)  

会话可以是YashanDB模式，或兼容模式，兼容模式下，优先识别兼容模式的词法和语法。

![](https://pingcode.yasdb.com/atlas/files/public/67396e1ea1ad9a3311dc9525/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA1NzksImV4cCI6MTc4MjM4MTM3OX0.1of1C3aeaajYpLNCmCnW7kJpeZ81QQJXiA1Lb5zJ0Mw)

####   [4.2.1 兼容模式会话参数](#421-兼容模式会话参数)  

参数名： COMPAT_VECTOR

取值范围： [YASHAN/ORACLE, MYSQL]。

作用范围： 会话级

默认值：通过YashanDB协议连接时，默认值为YASHAN；通过MYSQL协议连接时，默认值为MYSQL

####   [4.2.2 SQL软解析](#422-sql软解析)  

同一条SQL语句，在不同模式下含义不同。例如，YashanDB模式下，双引号表示对象标识符，MySQL模式下则表示字符串。因此

select "ID" from test。在YashanDB表示查询test表的ID列，在MySQL模式下表示查询常量字符串”ID"。

##   [5.未来规划](#5未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[plugin_service.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMWVhMWFkOWEzMzExZGM5NTI0IiwicmVmX2lkIjoiNjczOTZlMWU1OTNmOTljOWZmMjM4MjQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwNTc5LCJleHAiOjE3ODI0NTY5Nzl9.Mxg63t112afy3MwAc8sArClJ4FXM0tiWQhw8PdHe7Ag)

 (image/png)    

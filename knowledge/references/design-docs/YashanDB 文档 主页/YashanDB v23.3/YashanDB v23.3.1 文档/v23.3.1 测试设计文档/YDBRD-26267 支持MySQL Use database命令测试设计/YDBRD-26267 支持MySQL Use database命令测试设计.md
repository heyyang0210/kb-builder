Created by 刘立, last modified on 八月 29, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/661913a5fd997db58ad89169](https://pingcode.yasdb.com/pjm/items/661913a5fd997db58ad89169)    ?    
  #YDBRD-26267 支持MySQL Use database命令

1. 主要实现支持执行 use database 命令。
1. 内部对 mysql 兼容模式下创建的 user 和 schema 进行区分调整。


## 1.1 相关文档

开发设计：    [支持MySQL use database命令设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=162993703)  

测试调研：    [YDBRD-26267 支持MySQL Use database命令测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=162988197)  

其他：    [生态兼容总体设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141579751)  

# 2. 需求分析

## 2.1 功能点分析

1. use database 能连接到正确的 database，并且可以对 database 进行一系列操作。
1. mysql 兼容模式下创建的 user 和 schema/database 互相独立，不会出现 user、schema 识别错误的情况。


## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

1. mysql 兼容模式下创建的 database 不能用作登录用户。
1. mysql 兼容模式下创建的 user 仅作 user 使用，无法作为 schema 使用。
1. mysql 兼容模式下创建 database，yashan 模式下无法创建同名 user，反之同理。


# 3. 详细测试设计

## 3.1 测试设计方法

1. 对于 user database 功能正常生效，主要采用等价类划分进行测试分析；与 create user、create database、模式切换等功能交互，主要采用场景法进行测试分析。


## 3.2 详细测试设计

详细测试点分为两大类：

1. use database 功能测试
    1. use database 语法测试
    1. use database 功能测试
1. 与其他功能交互
    1. 与 drop database 交互
    1. create user 和 create database
    1. 使用不同的客户端连接 user
    1. 与 alter session set current_schema 交互
    1. 与模式切换交互
    1. create user 创建用户权限测试
    1. 多 session 使用同一个 database


1、新增 use database 语法

1）语法测试

|语句|有效等价类|无效等价类|
|---|---|---|
|use database|- 语句大小写
- 语句结尾包含/不包含分号';'
- use database 后接其他内容
- 包含数值、中文
- 反引号
|- 拼写错误
- 语句不完整
- 语句换行
|


2）功能测试

|测试点|有效等价类|有效等价类2|无效等价类|
|---|---|---|---|
|database 名称|- 存在的 database
- database 名称大小写
- create database 命令创建
- create schema 创建
|  
|- 拼写错误
- 不存在的 database
- 名称为'',"",null
|
|use database|- use database
- 重复 use 同一个 database
- 切换 database
- 指定在 yashan 模式下通过 create user 创建的 schema
    - 有密码用户
    - 无密码用户
- mysql 兼容模式下创建同名 user 和 database  **（连接的是database）**
|  
|- 指定在 mysql 兼容模式下创建的 user，映射后名称
|
|use database 后执行操作|- 在 database1 下执行建表和 dml 操作
- 在 database2 下执行指定 database1 执行建表（指定全名）和dml操作
- 在 database1 下同时对 database1 和 database2 下的表/视图进行操作
    - 表/视图在 database1 下创建，指定名称不带 schema，视图指定 table 不带 schema
    - 表/视图在 database1 下创建，名称带 schema 视图指定 table 带 schema
    - 表/视图在 use database1 时创建，创建 table 在 database2 中，视图指定 table 在 database2 中
|操作覆盖：,- talbe相关：ALTER TABLE、CREATE TABLE、CREATE TABLE AS、DROP TABLE、TRUNCATE TABLE
- 视图相关：CREATE VIEW、CREATE VIEW AS、DROP MATERIALIZED VIEW
- DML语句：SELECT、INSERT、UPDATE、DELETE
|  
|


2、与其他功能交互

1）mysql 兼容模式下执行 drop database

|测试点|有效等价类|无效等价类|
|---|---|---|
|drop database 只能删除 mysql 兼容模式下创建的 database|- 删除 mysql 兼容模式下创建的 database
|- 删除 mysql 兼容模式下创建的 user
    - 存在同名 database  **（第一次删除 database 成功，第二次删除 user 失败）**
    - 不存在同名 database
- 删除 yashan 模式下创建的 user
    - 有密码用户
    - 无密码用户
|
|drop database 不支持删除正在使用的 database|执行 use database,- 当前会话删除 database  **（删除失败）**
- 其他会话删除 database  **（删除失败）**
|  
|


2）mysql 兼容模式下执行 create database 和 create user

|测试点|有效等价类|无效等价类|
|---|---|---|
|mysql 兼容模式下执行 create database|- mysql 兼容模式下已创建 user，创建同名 database
|- yashan 模式下已创建 user，mysql 兼容模式下创建同名 database
|
|mysql 兼容模式下执行 create user|- mysql 兼容模式下已创建 database，创建同名 user
|- yashan 模式下已创建 user，mysql 兼容模式下创建同名 user
|
|yashan 模式下执行 create user|  
|- mysql 兼容模式下已创建 database，yashan 模式下创建同名 user
- mysql 兼容模式下已创建 user，yashan 模式下创建同名 user
|
|视图 DBA_USERS|- mysql 兼容模式下创建的 database  **（视图显示与database名称一致）**
- mysql 兼容模式下创建的 user  **（视图显示$MY_+username）**
|  
|


3）通过 mysql 客户端、yasql 客户端连接 user

|测试点|有效等价类|无效等价类|
|---|---|---|
|mysql 客户端连接 user|- 指定 mysql 兼容模式下创建的 user  **（连接后不存在 database，无法执行需要 database 的操作，可执行不需要 database 的操作）**
    - 指定 user 名称连接
    - 指定 user 映射后名连接
- 指定 yashan 模式下创建的 user  **（连接后 database 正确可用）**
- mysql 兼容模式下创建同名 user 和 database  **（成功连接 user，连接后 database 无法使用，需要执行 use database）**
|- mysql 兼容模式下创建的 database
|
|yasql 客户端连接 user|- 指定 mysql 兼容模式下创建的 user  **（连接后 schema 不可用，无法执行需要 schema 的操作，可执行不需要 schema 的操作）**
    - 指定 user 名称连接
    - 指定 user 映射后名连接
- mysql 兼容模式下创建同名 user 和 database  **（成功连接 user，连接后 database 无法使用，需要执行 use database）**
|- mysql 兼容模式下创建的 database
- mysql 兼容模式下创建的 user，名称中包含小写字母
|


4）use database、alter session set current_schema 和模式交互

|测试点|有效等价类|无效等价类|
|---|---|---|
|yashan 模式切换 schema|- 指定 mysql 兼容模式下创建的 schema
- mysql 兼容模式下创建同名 user 和 database  **（连接的是database）**
|- 指定 mysql 兼容模式下创建的 user，映射前名称
- 指定 mysql 兼容模式下创建的 user，映射后名称
|


5）模式切换不影响已执行的 use database

|测试点|场景|预期结果|
|---|---|---|
|切换模式不会影响正在使用的 schema|1. mysql 兼容模式执行 use database 切换 database
1. 切换到 yashan 模式使用
1. yashan 模式执行 alter session set current_schema 切换 schema
1. 切换到 mysql 兼容模式使用
|切换模式不影响正在使用的 schema|


6）mysql 兼容模式下 create user，用户在 yashan 模式，mysql 兼容模式下连接，权限正确

|测试点|有效等价类|无效等价类|
|---|---|---|
|mysql 兼容模式创建 user 权限测试|- 不同权限的 user 连接后使用 mysql 兼容模式
    - 赋予不同的 database 操作权限，对有权限的 database 进行操作
- 不同权限的 user 连接后使用 yashan 模式
    - 赋予不同的 database 操作权限，对有权限的 database 进行操作
|- 对无权限的 database 进行操作
|


7）多 session 场景

|测试点|场景|预期结果|
|---|---|---|
|多 session use database 指定同一个 database|- session1 create database、use database
- session2 use database
- session3 使用另一个用户连接 use database
|所有 session 均可使用 database 进行操作|


|系统级DFX分类|是否涉及|
|---|---|
|CT|N|
|KT|N|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[YDBRD-26267 支持MySQL Use database命令文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjFhMWFkOWEzMzExZGM5NmYxIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjcxLCJleHAiOjE3ODI0NTgwNzF9.YZk9b1do0YrroeoWtzMUT_auSkmgxypvGehnQlBD9j4)

# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


# 8. 与 mysql 的差异点

|序号|yashan|mysql|
|---|---|---|
|1|正在被使用的 shcema 任何会话均无法删除|正在被使用的 schema 可以删除|
|2|schema 名不区分大小写,无法 use yashan 模式下创建的小写 schema|schema 名称区分大小写|


  


## Attachments:

[YDBRD-26267 支持MySQL Use database命令文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjE4OTcwYzJhZjRmNTIxODdlIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjcxLCJleHAiOjE3ODI0NTgwNzF9.2HeRHH1xQ2S5Tpor4FbAZBZ0aFC3wLqdtSHVnOKmqHg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26267 支持MySQL Use database命令文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjFhMWFkOWEzMzExZGM5NmYxIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjcxLCJleHAiOjE3ODI0NTgwNzF9.YZk9b1do0YrroeoWtzMUT_auSkmgxypvGehnQlBD9j4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,【会议纪要】,与会人：陈关羽、林永豪、张鹏飞、孟麟、刘立    
  会议时间：2024-08-13 16：00 ~ 16：30    
  会议地点：线上    
  腾讯会议：455-216-512    
  纪要信息：    
  1、mysql 兼容模式下创建 user，yashan 模式下无法创建同名 user，反之同理。    
  2、mysql 兼容模式、yashan 模式，切换 schema 指定 user 为映射后的名称，禁用此场景。    
  3、补充视图在 database1 创建，切换到 database2 查询视图，视图指定的 schema.table 不变。同时分析一下是否还有类似的场景。,评审通过与否：通过,Posted by liuli at 八月 13, 2024 16:36|
|---|

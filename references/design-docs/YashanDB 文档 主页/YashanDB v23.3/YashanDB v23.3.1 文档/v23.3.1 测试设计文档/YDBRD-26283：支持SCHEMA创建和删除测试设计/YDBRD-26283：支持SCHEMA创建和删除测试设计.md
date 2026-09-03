Created by 刘晓旋, last modified on 十月 09, 2024

# 1. 概述

IR链接：    [YASHAN-929](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f1?%20#YASHAN-929%20%20%E3%80%90mysql%E5%85%BC%E5%AE%B9%E3%80%91%EF%BC%88%E5%8A%9F%E8%83%BD&%E8%AF%AD%E6%B3%95%EF%BC%89%E6%94%AF%E6%8C%81SCHEMA%E3%80%81%E5%8F%8C@@%E5%8F%82%E6%95%B0%E5%8F%98%E9%87%8F%E7%AD%89%E7%9A%84%E7%89%B9%E5%AE%9A%E7%89%B9%E6%80%A7)  

SR链接：    [YDBRD-26283](https://pingcode.yasdb.com/pjm/items/66191659fd997db58ad89545?%20#YDBRD-26283%20%E6%94%AF%E6%8C%81SCHEMA%E5%88%9B%E5%BB%BA%E5%92%8C%E5%88%A0%E9%99%A4)  

兼容 MySQL，支持 SCHEMA 创建和删除

# 2. 需求分析

## 2.1 功能点分析

- 创建 schema


![](https://pingcode.yasdb.com/atlas/files/public/67396e65a1ad9a3311dc96ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBZ0FBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFRQUFBQUFJQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBRUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3ODcsImV4cCI6MTc4MjM4MjU4N30._u6yJqIzlMmhfO-vgRpT3-t9qhnvDaUXDWSD4hQ7czg)

- 修改 schema


![](https://pingcode.yasdb.com/atlas/files/public/67396e65a1ad9a3311dc9700/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBZ0FBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFRQUFBQUFJQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBRUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3ODcsImV4cCI6MTc4MjM4MjU4N30._u6yJqIzlMmhfO-vgRpT3-t9qhnvDaUXDWSD4hQ7czg)

- 删除 schema


![](https://pingcode.yasdb.com/atlas/files/public/67396e65a1ad9a3311dc9701/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBZ0FBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFRQUFBQUFJQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBRUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE3ODcsImV4cCI6MTc4MjM4MjU4N30._u6yJqIzlMmhfO-vgRpT3-t9qhnvDaUXDWSD4hQ7czg)

## 2.2 应用场景

mysql> create schema s1;

mysql> alter schema s1 character set 'gbk';

mysql> drop schema s1;

## 2.3 规格约束

与 MySQL 的差异：

1、  CHARACTER SET 和 COLLATE 只支持以下字符集和字符序。对于不支持的字符集和字符序直接语法报错：

|支持设置的mysql字符集|映射到的yashan字符集|
|:---|:---|
|ASCII|ASCII|
|GB18030|GB18030|
|GBK|GBK|
|LATIN1|ISO8859-1|
|UTF16|UTF-16|
|UTF8|UTF-8（注意：MySQL 的 utf8 最大支持3字节，MySQL 的 utf8mb4 最大支持4字节，Yashan 的 utf-8 最大支持4字节。）|
|UTF8MB4|UTF-8|
|UTF8MB3|UTF-8|


|支持设置的mysql字符序|映射到的yashan字符序|绑定哪个字符集|
|---|---|---|
|UTF8MB4_BIN|UTF8_GENERAL_CS|UTF8|
|UTF8MB4_GENERAL_CI|UTF8_GENERAL_CI|UTF8|


2、schema 名称、字符集名称和字符序名称，支持使用单引号、双引号、反引号括起

3、  schema 名称命名规范，遵循 yashan 的命名规则

4、create/alter/drop schema 的前提是具有 create/alter/drop user 的权限。

5、create/alter/drop schema的数据库对象操作，对应yashan的create/alter/drop user。

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：函数参数–边界值；等价类*

*场景法覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用 xmind 的方式*
    1. *create schema *  *测试*
    1. *alter schema *  *测试*
    1. *drop sehcma 函数*  *测试*
    1. *交互测试*


**a. create schema 测试**

|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|语法测试    
    
    
    
    
    
    
    
    
    
    
    
    
    
|语句语法|- 语句大小写
- 语句包含/不包含 [IF NOT EXISTS]
- 语句包含/不包含 DEFAULT
- 语句不包含 [create option]
- 语法包含 [create option]，覆盖：只含 CHARACTER SET、只含 COLLATE、同时包含 CHARACTER SET 和 COLLATE
- CHARACTER SET 和 COLLATE 的位置互换
|- schema 为空，如：create schema;
- CHARACTER SET 拼写错误、残缺：CHARACTER SETS、CHARACTER、CHARACT SET
- COLLATE 拼写错误：COLLATES、COLLATION
- CHARACTER SET 后为空：create schema s1 CHARACTER SET;
- COLLATE 后为空：create schema s1 COLLATE;
|  
|
||schema 名称|- 大小写
- 遵循 Yashan 对象命名规范：  必须以字母开头、可包含数值、中文
- 带双引号，覆盖：大小写、特殊字符
- 反引号
|- 保留关键字命名
- 特殊字符、转义符
- 名称长度大于64字节
- 名称为 ''、""、null
|  
|
||CHARACTER SET|- Yashan 支持的字符集：  ASCII、GB18030、GBK、UTF-16、UTF-8、UTF8MB4、UTF8MB3、LATIN1
- 字符集名称大小写
- 字符集名称使用单双引号、反引号括住
|- Yashan 不支持的字符集：  ISO8859-1  、UTF32、ARMSCII8 等
- 指定的字符集名称为：''、""、null
|  
|
||COLLATE|- Yashan 支持的字符序：  UTF8_GENERAL_CS、UTF8_GENERAL_CI
- 字符序名称大小写
- 字符序名称使用单双引号、反引号括住
|- Yashan 不支持的字符序：  utf8mb4_0900_ai_ci、armscii8_bin、ascii_bin、utf8mb4_bin 等
|  
|
||DEFAULT|- 多个相同 DEFAULT 字符集：create schema s1 default character set gbk default character set gbk;
- 多个相同 DEFAULT 字符序：create schema s1 default collate   UTF8_GENERAL_CS   default collate   UTF8_GENERAL_CS  ;
- 多个相同字符集和字符序，其中部分指定 default、部分不指定 default
|- 多个不相同的 DEFAULT 字符集：create schema s1 default character set utf8 default character set gbk;
- 多个不相同的 DEFAULT 字符序：create schema s1 default collate   UTF8_GENERAL_CS    default collate   UTF8_GENERAL_CI;
|  
|
||字符序合法性|- 字符序合法，如  character set 为 utf8，collate 为   UTF8_GENERAL_CS
|- 字符序非法，如 character set 为 gbk，collate 为   UTF8_GENERAL_CS
|  
|
|功能测试    
    
    
    
|schema 命名为管理员|- 创建 schema，schema 名称为 sys、sysdba、sysoper
|  
|  
|
||创建同名 schema|- 创建重名 schema，带 [IF NOT EXISTS]
|- 创建重名 schema，不带 [IF NOT EXISTS]
|  
|
||登录 schema |- 使用 schema 账号登录，预期报错用户不存在（dba_users 查到的用户名登录报错锁定）
- 使用 sys 用户解锁 schema，登录成功，在该 schema 下创建/使用对象成功
|  
|  
|
||创建同名 user|- 创建同名 user，在该 user 下 alter schema
- 创建同名 user，在该 user 下 drop schema
- 创建同名 user，在该 user 下操作已存在的 schema.对象（覆盖：增删改查、alter/drop）
- 创建同名 user，在该 user 下操作创建不存在的 schema.对象
|- 创建同名 user，在该 user 下创建同名的 schema（失败）
- 创建同名 user，执行操作的时候带上 user.schema.对象，如 select * from s1.s1.t1;（失败）
|  
|
||权限|- 用户下具有创建 user 的权限，在该用户下创建 schema
- 多个 session，用户A 在 session1 赋予 create schema 权限，在 session2 撤销 create schema 权限，session1 也同步撤销
|- 用户下不具有创建 user 的权限，在该用户下创建 schema（失败）
|  
|
||user系统表|- 创建  schema 后，检查 dba_user 等 user 系统表显示该 user 
|  
|  
|
|元数据展示方式||show create schema s1; 在以下 SR 支持，现需求暂不关注：,  [https://pingcode.yasdb.com/pjm/items/66191587fd997db58ad89342](https://pingcode.yasdb.com/pjm/items/66191587fd997db58ad89342)    ?    
  #YDBRD-26280 支持MySQL Show语句|||


**b. alter schema 测试**

|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|语法测试    
    
    
    
    
    
    
    
    
    
    
    
    
    
|同 create schema|  
|  
|  
|
|功能测试    
    
    
    
|
||修改同名 schema|- 修改同名 schema 多次
- alter_option 测试点同 create_option
|  
|  
|  
|
||修改 schema 的用户属性|- 通过 alter user 修改 schema 的密码、过期、锁定、指定该 schema 放在 profile 下
|  
|  
|
||权限|- 用户下具有修改 user 的权限，在该用户下修改 schema
- 多个 session，用户A 在 session1 赋予 alter schema 权限，在 session2 撤销 alter schema 权限，session1 也同步撤销
|- 用户下不具有修改 user 的权限，在该用户下修改 schema
|  
|


**c. drop schema 测试**

|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|语法测试    
    
    
    
    
    
    
    
    
    
    
    
    
    
|语句语法|- 语句大小写
- 语句包含/不包含 [IF EXISTS]
|- schema 为空，如：drop schema;
|  
|
||schema 名称|- 大小写
- 遵循 Yashan 对象命名规范：  必须以字母开头、可包含数值、中文
- 带双引号，覆盖：大小写、特殊字符
|- 保留关键字命名
- 特殊字符、转义符
- 名称长度大于64字节
- 名称为 ''、""、null
|  
|
|功能测试    
    
    
    
|重复删除 schema|- 重复删除 schema，带 [IF EXISTS]
|- 重复删除 schema，不带 [IF EXISTS]
|  
|
||删除同名 user|- 同名 user 存在，drop user 成功
|- 同名 user 不存在，删除 user 失败
|  
|
||登录 schema |- 删除 schema 后，使用 schema 账号登录，登录失败
|  
|  
|
||权限|- 用户下具有删除 user 的权限，在该用户下删除 schema
- 多个 session，用户A 在 session1 赋予 drop schema 权限，在 session2 撤销 drop schema 权限，session1 也同步撤销
|- 用户下不具有删除 user 的权限，在该用户下删除 schema（失败）
|  
|
||user系统表|- 删除  schema 后，检查 dba_user 等 user 系统表该 user 已被删除
|  
|  
|




**d. 交互测试**

|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|功能测试    
    
    
    
|多 session|- 在 session1 create schema，session2 alter schema，session3 drop schema
|  
|  
|


  


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*    


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|
|兼容性|集群、分布式不支持，拦截报错|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

[MySQL schema 冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjQ4OTcwYzJhZjRmNTIxODhhIiwicmVmX2lkIjoiNjczOTZlNjQ3MjgyMDZlZmI5MmYyN2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNzg3LCJleHAiOjE3ODI0NTgxODd9.T4YEyTQZB6qq1nWLwpYJgLriQe5z6oqZ7Lh1iiB80tc)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

## Attachments:

[image2024-4-29_18-7-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjU4OTcwYzJhZjRmNTIxODhiIiwicmVmX2lkIjoiNjczOTZlNjQ3MjgyMDZlZmI5MmYyN2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNzg3LCJleHAiOjE3ODI0NTgxODd9.Z7ZxuO5uPNCVdZy3Yt4ylrxCcUPy8LJEalB8t6hCxFs)

 (image/png)    


[image2024-4-29_18-7-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjU4OTcwYzJhZjRmNTIxODhjIiwicmVmX2lkIjoiNjczOTZlNjQ3MjgyMDZlZmI5MmYyN2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNzg3LCJleHAiOjE3ODI0NTgxODd9.v2vI0FlDwHfhzfpelQyRRNyCXMP9MWSIaBO6J21nCGs)

 (image/png)    


[MySQL schema 冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjQ4OTcwYzJhZjRmNTIxODhhIiwicmVmX2lkIjoiNjczOTZlNjQ3MjgyMDZlZmI5MmYyN2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNzg3LCJleHAiOjE3ODI0NTgxODd9.T4YEyTQZB6qq1nWLwpYJgLriQe5z6oqZ7Lh1iiB80tc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,与会人：林永豪、张鹏飞、胡晓畔、刘晓旋    
  会议时间：2024-5-06 15：00 ~ 16：00    
  腾讯会议：154 598 951    
  纪要信息：,1、多session的情况无必要覆盖,评审通过与否：通过,Posted by liuxiaoxuan at 五月 08, 2024 17:47|
|---|

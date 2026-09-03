Created by 史鑫 on 八月 28, 2024

  [https://pingcode.yasdb.com/pjm/items/66190eb9fd997db58ad889de](https://pingcode.yasdb.com/pjm/items/66190eb9fd997db58ad889de)    ?    
  #YDBRD-26258 支持MySQL用户创建、删除功能

#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

此需求主要是语法兼容。支持mysql的语法：

- 创建用户：  CREATE USER 'yasdb'@'%' IDENTIFIED BY ‘XXX’;
- 删除用户：  DROP USER 'yasdb'@'%'


#   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

## 语法兼容点：

（1）用户名三个格式：‘userName’@'%' /‘userName’/userName，必须按照此规则指定用户名。

（2）ip仅仅做语法兼容，不指定/指定成‘%’均可，其他格式全报错。

（3）用户名去除双引号存储，去除双引号的长度上限为：  **64**

（4）name由于在包裹符号内部，合法性不做校验。不包裹要校验，规则参照MySQL

（5）密码也必须是在包裹符内   ‘XXX’。

（6）大小写敏感：用户名/密码认证都是大小写敏感。特别是用户名，和原始的sql保持一致。

|sql|用户名-mysql|用户名-yashan|
|---|---|---|
|create user a;|a|A|
|create user "a";|a|a|
|create user A;|A|A|
|create user "A";|A|A|


（7）创建是否upper：密码/用户名，不管在不在单引号内，都保持原始字符串，不做upper。

~~（8）MYSQL.SCHEMA$有没有适配点？？–无，schame是专有语法创建的，不在create user 过程联动创建。~~

以上兼容仅在mysql的兼容模式下支持。

## 后续IP属性的支持：

**存储**  ：增加映射表：IP$，此系统表以用户id：USER#做映射。  user: IP = 1:n

**创建用户：**   user:+ IP是唯一的

**认证**  ：mysql兼容登录，需要loadIP from IP$(user#)，and chek client IP

![](https://pingcode.yasdb.com/atlas/files/public/67396e978970c2af4f521993/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFnQUNBQUFBQUFFQUFBQUFBZ0FBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgyMjQsImV4cCI6MTc4MjQ0OTAyNH0.-V2-LEjt1zNhZqGwndqOipJ_DQnZ5mH2Eq0qgWoJH7I)

## 删除用户，mysql模式下，用户下对象是否有没有删的–已确认，已经适配了

|对象类型|mysql多余系统表数据的删除确认|action flag|适配情况|
|---|---|---|---|
|MYSQL.SCHEMA$|drop user 已经适配|COMPAT_DROP_SCHEMA|## 已适配|
|MYSQL.STORED_OBJECT_OPTIONS$|  
|  
|## 已适配|
|MYSQL.COLUMN_PROPERTY$|- 表入口
- 用户入口
    - obj$的type是表，统一删表中删除多余信息
|  
|## 已适配|


#   [3.规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

## 用户ip

|  
|差异点|说明|
|---|---|---|
|yashan|- **userName是唯一的/userID也是唯一的。**
- dev分支的ip的限制 仅来自于全局。没有ip用户限制的功能。
- 后续用户级别ip的限制，yashan是通过profile控制的。
|- yashan仅仅做语法适配，不实现此能力。
|
|mysql|userName : ip = 1：n，即对于mysql而言，  **userName+ip才是唯一的用户 标识**||


#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

语法兼容

# 5.兼容性

无

#   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

无

#   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

无

#   [7.](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)    其他

### mysql的string/name类型包裹符问题：

  [MySQL ：： MySQL 8.4 参考手册 ：： 11.1.1 字符串文字](https://dev.mysql.com/doc/refman/8.4/en/string-literals.html)  

  [MySQL :: MySQL 8.4 Reference Manual :: 11.2 Schema Object Names](https://dev.mysql.com/doc/refman/8.4/en/identifiers.html)  

|类型|包裹符号|
|---|---|
|name|- 反引号
- 设置     [](https://dev.mysql.com/doc/refman/8.4/en/sql-mode.html#sqlmode_ansi_quotes)     下：双引号
|
|string|- 单引号
- 不设置    [](https://dev.mysql.com/doc/refman/8.4/en/sql-mode.html#sqlmode_ansi_quotes)     ：双引号
|


  [](https://dev.mysql.com/doc/refman/8.4/en/sql-mode.html#sqlmode_ansi_quotes)    ：    [MySQL运维实战｜SQL_MODE之ANSI_QUOTES - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/680747840)  

### 创建用户相关语法项：

|项|子项|
|---|---|
|用户名|- 用户名
    - string类型--可以
    - name类型--可以
- ip
    - string类型--可以
    - name类型--可以
- @
    - 什么包裹符都不能带
|
|密码|只能是string格式|


### 大小写问题：mysql兼容模式下，要和mysql行为一致

场景：

|一级|二级|  
|
|---|---|---|
|用户|- 创建
- 删除
- 更改
- 授权
- 回收权限
- 切schema
|  
|
|shema|带schema查询|  
|


调研：

|类型|参数控制|  
|
|---|---|---|
|用户名|敏感|  
|
|表名|lower_case_table_names |![](https://pingcode.yasdb.com/atlas/files/public/67396e97a1ad9a3311dc9807/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFnQUNBQUFBQUFFQUFBQUFBZ0FBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgyMjQsImV4cCI6MTc4MjQ0OTAyNH0.-V2-LEjt1zNhZqGwndqOipJ_DQnZ5mH2Eq0qgWoJH7I)|
|shema|  
|  
|


## Attachments:
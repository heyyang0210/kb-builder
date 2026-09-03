Created by 孟麟 on 十月 31, 2023

# **1. 概述**

1、EXP/IMP支持导入导出DBLINK对象（元数据）。

2、  权限支持 CREATE DATABASE LINK / CREATE PUBLIC DATABASE LINK / ALTER DATABASE LINK / ALTER PUBLIC DATABASE LINK / DROP PUBLIC DATABASE LINK五种权限，权限间相互独立  。

——drop默认就有？开发：需新增

3、  审计支持对SQL_CREATE_DBLINK / SQL_ALTER_DBLINK / SQL_DROP_DBLINK 三种SQL类型进行审计，只支持对操作行为的审计。

——insert 远端表，insert的审计增加dblink场景的校验

# **2. 需求分析**

SR：       [YDBRD-13333](https://jira.yasdb.com/browse/YDBRD-13333?src=confmacro)    -  实现DBLINK的导入导出元数据、权限和审计能力  完成

设计：    [YDBRD-13333:实现DBLINK的导入导出元数据、权限和审计能力](https://conf.yasdb.com/pages/viewpage.action?pageId=107382292)  

1、新增dblink导入导出、权限和审计功能，是在现有框架(导入导入、权限和审计)上进行适配，纳入dblink的内容，  **测试重点关注dblink本身**

2、其他影响：

1）  DBA_DB_LINKS视图新增password字段，需要修改存量用例

2）create语法调整：  create xxx identified by   **values E12345678894343**  ，需补充用例覆盖

# **3. 测试**  **设计方法**

通用的场景、组合等测试方法

# 4.   **详细测试设计**

# 5.   **测试用例**

待输出

# **6 测试框架设计**

导入导出依赖现有导入导出测试框架

  


## Attachments:

[实现DBLINK的导入导出元数据_权限和审计能力.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmM4OTcwYzJhZjRmNTFmYjZhIiwicmVmX2lkIjoiNjczOTY5ZmM3MjgyMDZlZmI5MmVmOTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjI0LCJleHAiOjE3ODIyOTcwMjR9.2QxrSE3a1jLoQGrd4YMr2tGqGHFL2ZMBkUe1GluJQYY)

 (application/x-xmind)    

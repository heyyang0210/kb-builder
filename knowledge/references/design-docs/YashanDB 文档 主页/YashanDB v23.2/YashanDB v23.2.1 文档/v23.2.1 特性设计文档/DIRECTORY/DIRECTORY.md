Created by 张锐, last modified by  江祉涵 on 十月 20, 2023

###   [CREATE DIRECTORY](#create-directory)  

sql语法：CREATE [OR REPLACE] DIRECTORY directory AS 'path_name';

###   [DROP DIRECTORY](#drop-directory)  

sql语法： DROP DIRECTORY directory_name;

##   [1. Overview（概述）](#1-overview概述)  

YashanDB支持创建删除目录。

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持创建目录
- 支持删除目录


示例sql：

```
CREATE OR REPLACE DIRECTORY shared_directory AS '/path/to/shared/directory';

DROP DIRECTORY shared_directory;

```

##   [3. Interfaces（接口）](#3-interfaces接口)  



![](https://pingcode.yasdb.com/atlas/files/public/67396c09a1ad9a3311dc873a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUJBUUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3MDUsImV4cCI6MTc4MjMwOTUwNX0.gemcSjKYTRKgQslG_gsZAAVuavtyVLvrTQxEvbTNSe8)

![](https://pingcode.yasdb.com/atlas/files/public/67396c09a1ad9a3311dc873b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUJBUUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3MDUsImV4cCI6MTc4MjMwOTUwNX0.gemcSjKYTRKgQslG_gsZAAVuavtyVLvrTQxEvbTNSe8)

  


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 创建目录时不对路径是否存在做判断，需要在使用该目录时再做判断
- 不允许使用父目录
- 默认用户为sys且不能修改
- 路径最大长度为4000


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

YashanDB支持创建目录

- 根据输入的目录名创建object
- 将创建的objectid以及目录路径写入新添加的系统表dir$
- 新增权限create any directory，只有拥有该权限的用户才能创建directory


YashanDB支持删除目录

- 根据输入的目录名删除对应的目录
- 新增权限drop any directory， 只有拥有该权限的用户才能删除directory


  


  


  


###   [5.1 系统表设计](#51-系统表设计)  

新增系统表dir$存放目录对应地址

|字段|类型|说明|
|---|---|---|
|obj#|BINARY_BIGINT，not null|目录oid|
|os_path|VARCHAR(4000)|目录地址|


###   [5.2 系统视图](#52-系统视图)  

新增系统视图all_directories,dba_directories

|字段|类型|说明|
|---|---|---|
|owner|VARCHAR(64)，not null|目录owner名字|
|directory_name|VARCHAR(64), not null|目录名称|
|directory_path|VARCHAR(4000)|目录地址|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

ddl测试场景：

- create or replace directory
- drop directory


## Attachments:

[organization_clause.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDVhMWFkOWEzMzExZGM4NzM3IiwicmVmX2lkIjoiNjczOTZjMDU3MjgyMDZlZmI5MmYwY2JjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzA1LCJleHAiOjE3ODIzODUxMDV9.3gQDiGnFTm-OfGPjyr8UAhOU3DOonU7caJWciWavIMY)

 (image/png)    


[external_table_data_props.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDk4OTcwYzJhZjRmNTIwOGM4IiwicmVmX2lkIjoiNjczOTZjMDU3MjgyMDZlZmI5MmYwY2JjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzA1LCJleHAiOjE3ODIzODUxMDV9.wdoH6wrYaLJgXrzToHxHVDs5iumXqr4IWLw9mTKoT_s)

 (image/png)    


[opaque_format_spec.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDk4OTcwYzJhZjRmNTIwOGM5IiwicmVmX2lkIjoiNjczOTZjMDU3MjgyMDZlZmI5MmYwY2JjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzA1LCJleHAiOjE3ODIzODUxMDV9.wcNH15Nmp2qbzX5KDVIMJhzuNnbKH2RfR1Y0jE-2Ae8)

 (image/png)    


[create_directory.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDlhMWFkOWEzMzExZGM4NzM4IiwicmVmX2lkIjoiNjczOTZjMDU3MjgyMDZlZmI5MmYwY2JjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzA1LCJleHAiOjE3ODIzODUxMDV9.iHjr_xCZ3C3p_v7HF3Azd8HEmv0-RSCszMzbFtjcdAE)

 (image/gif)    

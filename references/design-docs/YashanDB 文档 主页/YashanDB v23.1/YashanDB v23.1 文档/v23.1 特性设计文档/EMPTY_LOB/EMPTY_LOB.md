Created by 徐伟 on 六月 02, 2023

#   [支持EMPTY_CLOB，EMPTY_BLOB函数](#支持empty-clobempty-blob函数)  

22.2版本IR链接：    [https://jira.yasdb.com/browse/YDBRD-15517](https://jira.yasdb.com/browse/YDBRD-15517)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-15526](https://jira.yasdb.com/browse/YDBRD-15526)  

23.1版本IR链接：    [https://jira.yasdb.com/browse/YDBRD-11624](https://jira.yasdb.com/browse/YDBRD-11624)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-13544](https://jira.yasdb.com/browse/YDBRD-13544)  

##   [1. Overview（概述）](#1-overview概述)  

EMPTY_BLOB 和 EMPTY_CLOB用来初始化lob变量，常用在insert跟update语境中，使用该函数表名该lob变量被初始化，但是没有任何数据内容；但是不意味着为NULL或者空。

##   [2. Features（功能特性）](#2-features功能特性)  

1.语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396a2f8970c2af4f51fcef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUNBQUFnZ0FBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFvQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1NjksImV4cCI6MTc4MjIyMjM2OX0.Z2zKKpiUgH6cR4ojrm9QnJZdSm4UTiagTFZgJNFtF4s)

1. 使用如下：


```
SQL&gt; select length(empty_blob()) from dual;

LENGTH(EMPTY_BLOB())
--------------------
                   0

 create table lob_table_1(a blob, b clob, c int);
 insert into lob_table_1 values('1234','243',1);
 update lob_table_1 set a = empty_blob();

SQL&gt; select * from lob_table_1 where a is null;

未选定行

SQL&gt; select c from lob_table_1 where a is not null;

                             C
------------------------------
                             1
 

```

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult bifVerifyEmptyBlob(AnlVerifier* vrfr, ExprNode* node);
CodResult bifExecEmptyBlob(AnlStmt* stmt, ExprNode* node, Variant* retValue);
CodResult bifVerifyEmptyClob(AnlVerifier* vrfr, ExprNode* node);
CodResult bifExecEmptyClob(AnlStmt* stmt, ExprNode* node, Variant* retValue);
CodResult bifConcludeEmptyBlob(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);
CodResult bifConcludeEmptyClob(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);


```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 参数为空
- 直接select时有结果，不报错（oracle目前sqlplus报错，但sqldevelper上可以查出来；原因是：投影列是lob的情况下，lob数据需要单独请求一次，每个工具处理的方式不一样，所以表现不同并不为数据库bug）


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1.verify阶段直接赋返回值类型跟size大小

2.执行阶段只创建一个tempLob，不做其余操作

  


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

  


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1.直接select查询，判断返回是否为空，求返回length

2.在update、insert中使用

  


##   [7. Workload（工作量）](#7-workload工作量)  

待刷新

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

待刷新

![](https://pingcode.yasdb.com/atlas/files/public/67396a2fa1ad9a3311dc7b64/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUNBQUFnZ0FBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFvQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1NjksImV4cCI6MTc4MjIyMjM2OX0.Z2zKKpiUgH6cR4ojrm9QnJZdSm4UTiagTFZgJNFtF4s)

  


  


  


## Attachments:
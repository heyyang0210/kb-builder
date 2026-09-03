Created by 程康, last modified on 十月 31, 2024

  [https://pingcode.yasdb.com/ship/ideas/66de655d89f961f33010eb48](https://pingcode.yasdb.com/ship/ideas/66de655d89f961f33010eb48)    ?    
  #YASHAN-3310 C驱动支持设置SQL执行超时时间

##   [1. 总述](#1-总述)  

  


###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

  [SQLSetStmtAttr 函数 - ODBC API Reference | Microsoft Learn](https://learn.microsoft.com/zh-cn/sql/odbc/reference/syntax/sqlsetstmtattr-function?view=sql-server-ver16)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

1、conn参数YAC_ATTR_TIMEOUT 单位 s 范围[0-Integer.max]，设置为0 则不超时

2、作用范围：execute、directExecute

##   [4. 特性](#4-特性)  

![](https://pingcode.yasdb.com/atlas/files/public/6739e3b08970c2af4f53a761/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2OTUsImV4cCI6MTc4MjMzNTQ5NX0.sRwqLRSttSkMXYs3bauPhQCoJRH49QJpa3FuByAPhBw)

  


服务端处理yacCancel：

anlReleaseExecResource(stmt);

![](https://pingcode.yasdb.com/atlas/files/public/6739e3b0a1ad9a3311de25b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2OTUsImV4cCI6MTc4MjMzNTQ5NX0.sRwqLRSttSkMXYs3bauPhQCoJRH49QJpa3FuByAPhBw)

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
CodInt32  timeout = 1000;
    YAC_EXPECT_CALL(yacSetConnAttr(yac_con, YAC_ATTR_TIMEOUT, &timeout, sizeof(CodInt32)));
    YAC_EXPECT_ERROR_CALL(yacDirectExecute(hStmt, sql, sqlLen));
```

  


##   [6.资料设计章节](#6资料设计章节)  

conn 新加参数，YAC_ATTR_TIMEOUT，增加相关描述

##   [7.未来规划](#7未来规划)  

## Attachments:
Created by 邬建川, last modified on 九月 20, 2024

- SR链接：


  [#YDBRD-26089 session视图要展示客户端连接的软件版本、协议版本](https://pingcode.yasdb.com/pjm/items/6617cd1dfd997db58ad7a494?)  

##   [1. 总述](#1-总述)  

1.提供视图展示各连接对应的客户端软件版本、协议版本2.登陆日志打印相关的版本信息

###   [1.1 需求来源](#11-需求来源)  

- 支持形态： 单机， 集群，分布式


###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=167153868](https://conf.yasdb.com/pages/viewpage.action?pageId=167153868)  

###   [1.3 需求分析](#13-需求分析)  

通过$session视图，为数据库用户展示更多的客户端信息。

客户端信息添加在登录协议上，本SR把Oracle的v$session和v$session_connect_info中客户端相关的信息都添加了。

修改ReqLogin协议，见附件。协议增加4个字段。

|字段|类型|说明|
|---|---|---|
|CLIENT_PROTOCAL_VERSION|BIGINT|客户端协议版本，协议字段clientVersion|
|CLIENT_VERSION|VARCHAR(256)|客户端驱动版本，新增协议字段softwareVersion|
|CLIENT_DRIVER|VARCHAR2(256)|客户端驱动名，新增协议字段clientDriver|
|PORT|INTEGER|客户端端口号（无需加在协议上）|
|PROCESS|VARCHAR2(8)|操作系统客户端PID，新增协议字段process|
|MACHINE|VARCHAR2(256)|操作系统机器名，协议字段hostname|
|TERMINAL|VARCHAR2(256)|操作系统终端名，新增协议字段terminal|


需要适配新协议的：

|驱动|驱动名|软件版本|协议版本|
|---|---|---|---|
|c驱动|C DRIVER|c驱动版本|协议版本|
|python驱动|PYTHON DRIVER|同c驱动|协议版本|
|jdbc驱动|YashanDB JDBC Driver|jdbc版本|协议版本|
|NET驱动|ADO.NET|同c驱动|协议版本|
|Go驱动|GOLANG DRIVER|同c驱动|协议版本|
|yasql|YASQL|c驱动版本|c驱动版本|
|exp/imp|EXP_IMP|c驱动版本|协议版本|
|yasldr|YASLDR|c驱动版本|协议版本|
|oci|OCI|c驱动版本|协议版本|
|odbc|ODBC|c驱动版本|协议版本|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

###   [系统视图 & 动态视图](#系统视图--动态视图)  

####   [GV/DV/V$SESSION增加n个字段：](#gvdvvsession增加n个字段)  

|字段|类型|说明|
|---|---|---|
|CLIENT_PROTOCAL_VERSION|BIGINT|客户端协议版本|
|CLIENT_VERSION|VARCHAR(256)|客户端软件版本|
|PROCESS|VARCHAR2(8)|操作系统客户端PID|
|MACHINE|VARCHAR2(256)|操作系统机器名|
|PORT|NUMBER|客户端端口号（无需加在协议上）|
|TERMINAL|VARCHAR2(256)|操作系统终端名|
|CLIENT_DRIVER|VARCHAR2(256)|客户端驱动名，当前只上报到驱动的名称，不会展示具体的工具名。相关信息可暂时cli_program字段来获取|


##   [3. 规格与约束](#3-规格与约束)  

无

###   [规格变更](#规格变更)  

无

##   [4. 特性](#4-特性)  

- session视图要展示客户端连接的软件版本、协议版本


##   [5. 详细设计](#5-详细设计)  

###   [登录协议](#登录协议)  

登录协议增加相关信息到session结构体上。

![](https://pingcode.yasdb.com/atlas/files/public/67396e00a1ad9a3311dc94ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQVFBQUFBQUFBQWdBQUFBQUFBQUFBUUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM1MDAsImV4cCI6MTc4MjMyNDMwMH0.WGzc-T0lyGMX0n4u0YYKymEkixjH_ZAGdeo-ALBXL3g)

hasMoreConnMsg标志位：1表示package包后存在本次需求新增的协议字段，需要解析；0表示不存在本次需求新增的协议字段，无需解析。

softwareVersion：客户端软件版本。

process：客户端进程PID。

terminal：客户端终端名称。

clientDriver：客户端名称。

###   [视图](#视图)  

通过session结构体获取对应字段，添加到对应视图。

###   [日志](#日志)  

登录过程中，打印客户端 软件/协议 版本信息的日志。

##   [6. 自测](#6-自测)  

###   [基本测试](#基本测试)  

|测试点|预期|进展|
|---|---|---|
|yasql登录从log看到登录日志信息|包含protocal_version,client_version,client_driver|pass|
|c驱动登录后查视图|能查到新增字段，值无误|pass|
|yasql登录后查视图|v/dv/gv$session能够观测到对应的字段，且值正确|pass|
|exp登录后查视图|v/dv/gv$session能够观测到对应的字段，且值正确|pass|
|sqlloader登录后查视图|v/dv/gv$session能够观测到对应的字段，且值正确|pass|
|oci登录后查试图|字段都有|pass|
|odbc登录查视图|字段都有|pass|
|jdbc登录后查视图|jdbc的terminal是unknown|pass|
|python驱动登录后查视图|v/dv/gv$session能够观测到对应的字段，terminal是unknown|pass|
|go驱动登录查视图|查视图无误，terminal是unknown|pass|
|NET驱动登录后查视图|v/dv/gv$session能够观测到对应的字段terminal会是unknown|pass|


###   [驱动版本兼容测试](#驱动版本兼容测试)  

|测试点|预期|进展|
|---|---|---|
|NET驱动使用新C驱动|v/dv/gv$session能够观测到对应的字段，且值正确|pass|
|NET驱动使用旧C驱动|v/dv/gv$session无法观测到对应的字段|pass|
|老oci，新anchorbase|都有，driver为C DRIVER|pass|
|老odbc，新anchorbase|都有，driver为C DRIVER|pass|
|老go，新anchorbase|client_driver显示为"C DRIVER"，terminal为unknown|pass|
|老python，新anchorbase|client_driver显示为"C DRIVER"，terminal为unknown|pass|
|老jdbc，新anchorbase|client_protocal_version/port/machine字段有，machine为localhost，其他字段为空|pass|
|老anchorbase，新oci|无新增，连接不报错|pass|
|老anchorbase，新odbc|无新增字段，连接不报错|pass|
|老版本anchorbase，新版本python|无新增字段，连接不报错|pass|
|老版本anchorbase，新版本jdbc|无新增字段，连接不报错|pass|
|老anchorbase，新go|无新增字段，连接不报错|pass|


###   [客户端/服务端协议版本兼容测试](#客户端服务端协议版本兼容测试)  

|测试点|预期|进展|
|---|---|---|
|老版本客户端，新版本yasdb|client_protocal_version/port/machine字段有，其他字段为空|pass|
|老客户端，新yasdb|查看日志，没有登录信息日志|pass|
|老版本yasdb，新版本客户端|无新增字段，不报错|pass|


##   [7.资料设计](#7资料设计)  

略

##   [8.未来规划](#8未来规划)  

略

## Comments:

|  [](null)  ,测试用例： 旧服务端和新客户端/反过来,Posted by wujianchuan at 九月 11, 2024 10:31|
|---|
|  [](null)  ,时间：2024 / 9 / 11 10:00 - 11:00    
  参与人员：冯皓博，方少奎，施新华，罗爽，邬建川,评审纪要：    
  1.  CREATOR_ADDR字段不加,2.  测试用例补充服务端新旧版本的测试,Posted by wujianchuan at 九月 14, 2024 11:28|

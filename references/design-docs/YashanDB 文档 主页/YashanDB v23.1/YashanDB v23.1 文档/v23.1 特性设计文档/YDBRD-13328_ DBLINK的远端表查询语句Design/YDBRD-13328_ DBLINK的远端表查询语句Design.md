Created by 林永豪, last modified by  徐伟 on 六月 11, 2024

  


#   [YDBRD-13328 : DB Link Remote Query Design（实现DBLINK的远端表查询语句方案设计）](#ydbrd-13328--db-link-remote-query-design实现dblink的远端表查询语句方案设计)  

SR链接：    [YDBRD-13328](https://jira.yasdb.com/browse/YDBRD-13328)  

##   [1. Overview（概述）](#1-overview概述)  

  [DB LINK简介](https://conf.yasdb.com/display/~linyonghao/Yashan+DB+Link+Confs)  

  [DB LINK调研](https://conf.yasdb.com/pages/viewpage.action?pageId=104226806)  

DB LINK信息流向：

  


![](https://conf.yasdb.com/download/attachments/104217220/image2023-3-22_16-22-35.png?version=1&modificationDate=1679473356000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4NTIsImV4cCI6MTc4MjMwMDY1Mn0.IqQejE8R8IbMJBHXeGRCqCO1scSDFEZRAUBbADPLhso)

  


    - 以上分为三大部分，第一部分是yasdb板块，第二部分是ext_server板块，第三部分是远程数据库板块
    - yasdb板块发起查询，调用YLN(yashan db link)模块，YLN调用通用的YEX(yashan external)模块，与ext_server板块进行交互
    - ext_server模块负责和远程数据库模块进行交互。与oracle交互使用OCI接口，与yashan交互使用yashan的ODBC接口。
    - 为什么不直接让yasdb板块和远程数据库模块进行交互？
        - 因为远程数据库模块是yashan不能控制的模块。如果远程数据库core 或者远程数据库返回的 不兼容/非法 数据 可能会引起yasdb core。为了保证安全性，引入ext_server模块，可以理解为是一个沙箱模块，即便ext_server core了，也只会导致yasdb和ext_server断链，并不会影响yasdb上其它业务的进行


##   [2. Features（功能特性）](#2-features功能特性)  

23.1版本先考虑支持yashan->oracle和yashan->yashan两种形式

此SR主要聚焦三点：

- 1）DQL提取远端表查询子句，改写为QueryTable（谓词下推等单表查询功能，需要从PLAN转成SQL语句）
- 2）DC结构定义（OpenDc到远端获取DC构建，需要有一个基于不同数据库的元数据解析）
- 3）driver层OCI对接、数据类型map


##   [3. Interfaces（接口）](#3-interfaces接口)  

不提供对外接口

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 1）该版本支持yashan->oracle和yashan->yashan两种形式
- 2）数据类型的支持情况参照：    [数据类型支持情况](https://conf.yasdb.com/pages/viewpage.action?pageId=109593206)  
- 3）该SR只支持行存表，得先打通行列混合功能后才能支持列存表
- 4）注意，投影列不支持select dblink_remote_t3@dblink_y2y.* from dblink_remote_t3@dblink_y2y;    [这种又含有@和.的情况，报错invalid](mailto:%E8%BF%99%E7%A7%8D%E5%8F%88%E5%90%AB%E6%9C%89@%E5%92%8C.%E7%9A%84%E6%83%85%E5%86%B5%EF%BC%8C%E6%8A%A5%E9%94%99invalid)     symbol @，oracle也报错。如果想执行类似效果，给表起别名。
- 5）oracle->yashan不在此SR交付范围
- 6）注意，不支持truncate/drop/alter/create table t1@link4，报错invalid symbol @
- 7）不支持table.column@dblink形式的查询，报错invalid symbol @


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [1）DC结构定义](#1dc结构定义)  

    - （1）db link的内部存储和访问，涉及到两个概念：dict entry和dict entity。
        - dict entry可以理解为存储或访问该db link对象时的取用入口，通过entry可以拿到db link的具体信息。
        - dict entity是记录当前db link对象各种信息的载体，包括db link连接到的user、password、connstring等等。
    - （2）创建一个db link时，数据库内部会创建一个db link对象落盘，同时会将其对应的dict entry写入到当前user的obj hash bucket中，供之后取用
    - （3）访问db link对象时，会从系统表link$中将信息加载到db link的dict entity上，使得SQL层能通过dict entity访问db link对象的信息
    - （4）db link dict entity的结构：


```
typedef struct StDblinkEntity {
    SmartEntity     base;
    CodDate         createTime;
    CodUint64       flag;
    CodUint64       remoteKey;
    CodUint32       serverAge;
    CodUint16       nameLen;
    CodUint16       userLen;
    CodUint16       authUserLen;
    CodUint16       pwdLen;
    CodUint16       authPwdLen;
    CodUint16       connStrLen;
    CodChar         name[COD_NAME_BUFFER_SIZE];
    CodChar         user[COD_NAME_BUFFER_SIZE];
    CodChar         pwd[ANS_PASSWORD_CRYPTED_BUFFER_SIZE];
    CodChar         authUser[COD_NAME_BUFFER_SIZE];
    CodChar         authPwd[ANS_PASSWORD_CRYPTED_BUFFER_SIZE];
    CodChar         connStr[ANS_URL_BUFFER_SIZE];
} DblinkEntity;

```

###   [2）DQL提取远端表查询子句](#2dql提取远端表查询子句)  

实现框架：

在本地数据库是yashan，远端数据库是oracle或yashan时。本地数据库向远端数据库获取相关投影列的结果集，其余操作在本地数据库进行。

例子：

本地数据库yashan / 远端数据库oracle

本地数据库发起查询：select length(c1)+length(c2) from t1@dblink1;(dblink1是本地创建的dblink，t1是oracle数据库上的一张表，t1有三个列分别是c1、c2、c3

实际上内部的走向是：

（1）本地向远程发送带有相关投影列的简单查询，select c1,c2 from t1;将这条SQL语句发到远程数据库执行，远程数据库执行获取的结果集再发回给本地数据库

（2）由本地数据库算出length(c1)+length(c2)的运算结果

这样就完成了select length(c1)+length(c2) from t1@dblink1;的查询过程

####   [注意以下这种场景：](#注意以下这种场景)  

1.yashan连oracle的dblink建立后，yashan发起一条查询，查询oracle上某一张有两个列的表。

2.oracle上对这个有两列表的表，进行DDL操作比如alter table add column，使这张表变成了一张有三列的表。

3.yashan再发起上条查询，会报invalidate相关的错，表明远端表的元数据已经改变

4.yashan再发起这条查询，此时元数据已更新，能正常显示结果

####   [本地表、远端表类型交叉说明：](#本地表远端表类型交叉说明)  

|本地表|远端表|支持情况|
|---|---|---|
|行存|行存|√|
|行存|列存|√（可以理解为远端表在本地的副本是行存表）|
|列存|行存|×（会触发行列混合，不支持）|
|列存|列存|×（会触发行列混合，不支持）|


|远端表|远端表|支持情况|
|---|---|---|
|行存|行存|√|
|行存|列存|√（可以理解为远端表在本地的副本是行存表）|
|列存|行存|√（可以理解为远端表在本地的副本是行存表）|
|列存|列存|√（可以理解为远端表在本地的副本是行存表）|


####   [远端表的查询，不会把连接一起推到远端执行，是在本端连接](#远端表的查询不会把连接一起推到远端执行是在本端连接)  

具体场景：

|场景|备注|
|---|---|
|单表基本查询（SELECT *,投影列1列，投影列多列）|  [数据类型支持情况](https://conf.yasdb.com/pages/viewpage.action?pageId=109593206)  |
|单表基本查询(投影列是内置函数)|由实现框架有，只支持yashan所支持的内置函数|
|单表WHERE查询|谓词下推基于现在cbo的实现，比如某个filter推到了表上，若识别到这个表是一个远程表，就把这个filter和表扫描的计划生成出来，推到远端数据库执行，结果集发回本地|
|单表ORDER BY查询|若涉及到的表只有远程表，则将ORDER BY推到远程执行|
|单表GROUP BY （HAVING）查询|若涉及到的表只有远程表，则将GROUP BY推到远程执行|
|多个表JOIN查询，不同JOIN类型|若涉及到的表是远程表，则需要从远程获取结果集，然后在本地做join|
|子查询嵌套查询|若涉及到的表是远程表，则将查询推到远程执行，获取结果集|
|UNION子句连接多个结果集|若涉及到的表是远程表，则将查询推到远程执行，获取结果集|


###   [3）driver层OCI对接](#3driver层oci对接)  

尝试发起与远程数据库连接时，会针对每种数据库类型（目前是oracle/yashan）注册一组回调方法函数集合（prepare方法、executer方法、fetch方法、commit方法、rollback方法等等），然后与远程数据库进行连接

本地的yashan，可以通过OCI获取oracle远程数据库的信息。OCI是oracle提供的一组C语言函数库，可用于连接oracle数据库、执行SQL语句、处理查询结果、管理事务等等。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

###   [1）自测框架设计](#1自测框架设计)  

|方向|设计|
|---|---|
|yashan-->yashan|ut框架看护，需要起两个yasdb节点|
|yashan-->oracle|用oracle的返回结果来做打桩，ut框架看护yashan结果|
|oracle->yashan|不考虑，需等odbc工作进一步讨论|


###   [2）测试框架](#2测试框架)  

如果需要测yashan->oracle的dblink，需要CI上部署oracle

多并发查询测试场景

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:



 (application/octet-stream)    


## Comments:

|  [](null)  ,AR 14787:    [YDBRD-14787 实现DB LINK的计划生成和谓词下推](https://conf.yasdb.com/pages/viewpage.action?pageId=113970472)  ,Posted by linyonghao at 六月 15, 2023 16:31|
|---|
|  [](null)  ,列存表使用情况确认,Posted by linyonghao at 六月 15, 2023 20:20|

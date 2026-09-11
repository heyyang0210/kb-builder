Created by 陆世杰, last modified by  陈宜顺 on 十月 15, 2024

  [[YDBRD-16443] 【共享集群】pastCopy清理优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-16443)  

**现RAC共享集群在checkpoint时因pastcpoy无法持久化导致集群节点频繁重启，本文档分析RAC共享集群pastcopy故障原因并解决此问题。**

##   [1. Overview（概述](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#1-overview%E6%A6%82%E8%BF%B0)  

        崖山数据库共享集群环境(简称RAC)，RAC数据库实例的data buffer使用cache fushion机制，从而RAC中的data buffer为RAC中所有共享。

RAC的cache fushion机制产生了一种新的block类型，称为pastcopy简称PC（单机环境不存在该类型的block）。

                         pastcopy生成流程：    [Pastcopy的生成流程 - 龙忠友 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104230823)  

                         pastcopy清理流程：    [Pastcopy的清理流程 - 龙忠友 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104230829)  

pastcopy也是脏页，但为一种临失效状态的脏页，在chekpoint和buffer clean的场景下需要清理pastcopy类型block。

但pastcopy类型的block不能持久化，pastcopy block清理需要由cache fushion的发送多次message到RAC的owner节点，

在该block的owner节点的将Xcur block持久化后，该pastcopy block才能可以淘汰（CR/Free）。

RAC环境下xcur类型data block的持久化场景为：checkpoint和buffer clean；

checkpoint包括incremental checkpoint和full checkpoint；

buffer clean是为了平衡可用空间和利用率，从各个part的dirty list上淘汰内存页。

崖山数据库RAC脏页持久化流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396b18a1ad9a3311dc800b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBUUFBQUFBQUVFQUFBQUVBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQkFBQUFBQUFBQUFBQUVCQUFBQUFBQUFBQUlBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MTYsImV4cCI6MTc4MjMwMTcxNn0.GvZa2oxf6rvICPYXxdrhTxO1rHbRTgSkv1YDSJPmvKU)

  


  


buffer clean的流程为：

![](https://pingcode.yasdb.com/atlas/files/public/67396b198970c2af4f520195/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBUUFBQUFBQUVFQUFBQUVBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQkFBQUFBQUFBQUFBQUVCQUFBQUFBQUFBQUlBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MTYsImV4cCI6MTc4MjMwMTcxNn0.GvZa2oxf6rvICPYXxdrhTxO1rHbRTgSkv1YDSJPmvKU)

RAC集群的pastcopy清理最终都是调用buffer clean的机制，而buffer clean是为了buffer pool的free buffer使用。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1.共享集群RAC实例的buffer pool实现按指定block ctrl从checkpoint queue持久化脏页

2.共享集群RAC的checkpoint和buffer clean的pastcopy快速清理

3.pastcopy的消息缓存和淘汰，降低共享集群实例间消息风暴

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#3-interfaces%E6%8E%A5%E5%8F%A3)  

|文件|函数名称|简述|
|:---:|:---:|:---:|
|ank_dbwr.c|static void dbwrPrepareBlocks(AnkHandler* handler, DbwrManager* dbwrm, DbwrMode mode, CodUint64* maxLfn)|dbwrPrepareBlocks增加入口|
|ank_dbwr.c|dbwrPrepareCkptXcurBlocks(AnkHandler* handler, DbwrManager* dbwrm, CodUint64* maxLfn)|double buffer|
|ank_dbwr.c|dbwrPrepareCkptXcurBlock(AnkHandler* handler, DbwrManager* dbwrm, BufferCtrlBase* ctrl, BufferCtrlBase* ctrlNext, CodUint64* maxLfn, CodBool* needExit, CodBool* nextIsFlushed)|double buffer|
|ank_dbwr.c|static void dbwrPrepareCkptXcurBlock(AnkHandler* handler, DbwrManager* dbwrm, BufferCtrlBase* ctrl, BufferCtrlBase* ctrlNext, CodUint64* maxLfn, CodBool* needExit, CodBool* nextIsFlushed)|double buffer|
|ank_dbwr.c|static     void     dbwrRequestCkptXcur  (  DbwrManager  *     dbwrm  ,   DbwrMode     mode  )|dbwrPrepareBlocks增加入口|
|axc_gcs.c|static CodResult gcsOwnerFlushBlock(AnkHandler* handler, CleanBlock* blocks, CodUint32 blockCnt, CodUint16 requester, CodUint16 master)|gcs消息处理重写|
|axc_ckpt.c|axcDbwrInit(AnkHandler* handler, DbwrManager* dbwrm)|增加dbw写入的数据结构|
|  
|  
|  
|
|  
|  
|  
|


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

 共享集群RAC

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b198970c2af4f520197/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBUUFBQUFBQUVFQUFBQUVBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQkFBQUFBQUFBQUFBQUVCQUFBQUFBQUFBQUlBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MTYsImV4cCI6MTc4MjMwMTcxNn0.GvZa2oxf6rvICPYXxdrhTxO1rHbRTgSkv1YDSJPmvKU)

1.   新增按指定的bufferCtrl从checkpoint摘除脏页
1.    dbwr新增一种持久化机制入口
1.    集群消息blockId缓存到dbwr
1.    新增kfifo数据结构缓存ics_batch的消息，使用异步机制快速触发dbwr，若消息缓存容量或者dbwr处理不及时会淘汰没有处理的消息，但gcs会重发没有处理的PC的blockid过来


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#54-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#55-%E5%85%B6%E4%BB%96)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

checkpoint方式和以前一致，需额外产生pastcopy清理的测试并关闭所有实例的增量检查点

**反向清理测试**

- 产生pastcopy：
    - 创建一张100GB以上的单表，数据至少1000万行以上；
    - **实例A**  更新该表上所有block rowid为0（  SUBSTRING_INDEX(rowid,':',-1)=0  ）的行；
    - **实例B**  上更新该表上所有block rowid为5（  SUBSTRING_INDEX(rowid,':',-1)=5  ）的行
- 反向清理测试：
    - **实例A操作上**  ->查询视图    `V$GRC_PASTCOPY和v$checkpoint；`    执行alter system checkpoint，查询视图    `V$GRC_PASTCOPY和v$checkpoint`  
- ###### **测试评估**
    - ###### 计算所需checkpoint时间
    - ###### 检查实例间消息健康状态(是否因消息导致集群异常)


**正向清理测试**

- 产生pastcopy：
    - 创建一张100GB以上的单表，数据至少1000万行以上
    - **实例A**  更新该表上所有block rowid为0（  SUBSTRING_INDEX(rowid,':',-1)=0  ）的行；
    - **实例B**  上更新该表上所有block rowid为5（  SUBSTRING_INDEX(rowid,':',-1)=5  ）的行；
- 正向清理测试：
    - **实例B操作上**  ->查询视图    `V$GRC_PASTCOPY和v$checkpoint；`    执行alter system checkpoint，查询视图    `V$GRC_PASTCOPY和v$checkpoint`  
- ###### **测试评估**
    - ###### 计算所需checkpoint时间
    - ###### 检查实例间消息健康状态(是否因消息导致集群异常)


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


  


## Attachments:

[image2023-7-29_17-2-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMThhMWFkOWEzMzExZGM4MDA2IiwicmVmX2lkIjoiNjczOTZiMTg3MjgyMDZlZmI5MmYwMTk5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTE2LCJleHAiOjE3ODIzNzczMTZ9.wLzsYZvlqeH7rzL2-0foJBiodT0VOj4wl5-sSTTelzI)

 (image/png)    

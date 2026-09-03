Created by 陈宜顺, last modified by  梁荣钦 on 十月 12, 2024

#   [YDBRD-20500 : 支持本地SWAP表空间概要设计](#ydbrd-20500--支持本地swap表空间概要设计)  

IR链接：YDBRD-20500

##   [1. Overview（概述）](#1-overview概述)  

该需求来源于问题[    [YDBRD-16879] 【RAC集群】收集统计信息性能差，单机用时3分31秒，集群用时2小时43分44秒](https://jira.yasdb.com/browse/YDBRD-16879)  

参见之前的根因分析：

1. 磁阵IO性能较差
1. 单机的swap file有个优化，在open的时候，使用的是非sync模式，也就是swap out的时候只要写入fs缓存，就会返回。因为VM本身就是临时数据，如果进程挂掉或者宕机丢失不会对VM有影响。同时如果swap in的时候，fs缓存大概率会命中，不产生驱动层的IO。
1. 目前集群下swap file也是要通过YFS来管理，因此只能采用direct模式open raw device，每次swap out都是实打实的IO，而且swap in也不会有缓存。所以在产生大量vm swap时，性能差异和单机会很明显。


因此，需要支持本地swap表空间，通过本地文件系统优化集群下的swap file性能问题。

本次需要支持的部署形态为单机、集群，分布式场景用到的是本地文件系统，不需要磁阵环境，因此暂不涉及分布式场景。

##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|新增SWAP表空间|支持CREATE LOCAL SWAP TABLESPACE两种语法|支持本地路径和磁阵路径|
|修改SWAP表空间|支持ALTER TABLESPACE语法|暂不涉及新功能, 能修改现有的属性即可|
|删除SWAP表空间|支持DROP TABLESPACE语法|支持删除SWAP表空间|
|支持使用用户默认SWAP表空间|使用用户指定的默认SWAP表空间|当需要用到SWAP表空间时，使用用户默认的SWAP表空间|


##   [3. Interfaces（接口）](#3-interfaces接口)  

参考功能特性。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

参考详细设计

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

关键技术点讨论纪要：

1. 原来只有一个SWAP，VM都是记的表空间内的spaceBlockId，在有多个SWAP的情况下，如何选？处理方式：ctrl加spcId
1. 在线修改用户默认swap表空间怎么处理？处理方式：删掉前要保证swap表空间是空的
1. 表空间损坏场景，需要支持Drop swap表空间：


- 删掉前要保证表空间是空的
- 删除本地SWAP表空间处理：遍历本地session，确认没有用户在使用该表SWAP空间


1. 用户默认表空间一般使用当前用户，alter session set current_schema可以修改成与登录用户不一样；目前分析暂时没有太大影响
1.     - 待确认Oracle的行为

1. 需要修改USER系统表，加上默认SWAP表空间的信息
1.     - 考虑升级兼容性

1. 故障恢复，与临时表空间一致，启动时重置，实例间不需要同步


SR拆解：

|SR编号|SR标题|
|---|---|
|YDBRD-21722|支持本地SWAP表空间|


参考YashanDB对临时表空间设计的规格，SWAP表空间设计规格如下：

###   [5.1 建SWAP表空间语法](#51-建swap表空间语法)  

采用CREATE LOCAL SWAP TABLESPACE语法，指定临时文件路径时可以是本地路径或者磁阵路径，不可或者磁阵和本地路径混用

对于该种场景，表空间行为有如下特点:

- 特点1：SWAP文件信息（例如文件名、创建大小、创建 SCN、临时块大小和文件状态）与初始文件和最大文件以及自动扩展属性一起存储在控制文件中。但是，控制文件中有关本地临时文件的信息对于所有适用的实例都是通用的。
- 对于本地SWAP表空间，每个涉及的实例都有一个单独的文件。本地临时文件名遵循命名约定，以便实例编号附加到创建本地SWAP表空间时指定的临时文件名。类似Oracle的行为：
- 该语句要求所有的实例都要有这个本地文件所在的路径存在，如果某个实例不存在该路径或者因权限等问题创建文件失败，则整个语句失败。
- 当指定的是磁阵文件，也会生成多个磁阵文件，一个实例一个


```
oracle@oracle19crac01[racdb1]/u01/app/oracle/tmp$ll
total 24
-rw-r-----. 1 oracle asmadmin 8589942784 Oct 31 10:02 TEST_TMP01.dbf_1

oracle@oracle19crac02[racdb2]/u01/app/oracle/tmp$ll -h
total 24K
-rw-r-----. 1 oracle asmadmin 8.1G Oct 31 10:02 TEST_TMP01.dbf_2

oracle@oracle19crac03[racdb3]/u01/app/oracle/tmp$ll
total 24
-rw-r-----. 1 oracle asmadmin 8589942784 Oct 31 10:02 TEST_TMP01.dbf_3

```

###   [5.2 Architecture（架构）](#52-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b628970c2af4f52042e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM3MzQsImV4cCI6MTc4MjMwNDUzNH0.HlacPzrD4TIl-9zo3fqh4YasY9sgpAAnJe1BhFgPTuU)

###   [5.3 SWAP表空间规格](#53-swap表空间规格)  

- 表空间不可以同时指定磁阵文件和本地文件。
- 只使用用户默认的SWAP表空间。
- 本地SWAP表空间实例间不能共享，各用各的。
- 建库时默认使用的是本地SWAP表空间（待定？）
- 可以复用已存在的文件，如果要复用已存在文件，则不需要指定文件属性如SIZE
- 执行SWAP表空间DDL的SQL，需要有对应的权限
- 更多规格见详细设计文档


###   [5.4 故障恢复场景处理](#54-故障恢复场景处理)  

需要区分本地SWAP表空间和共享磁阵SWAP表空间上的处理

```
恢复期间对swap、temp的共享表空间的处理
    6). db master实例广播所有实例本地锁住swap、temp表空间的extent lock，防止业务修改表空间

```

- 本实例故障后，其它实例不需要锁住表空间，实例上业务可以继续进行
    - MSG_FREEZE_TEMP_SPACE等消息处理
    - rfmTempSpace函数处理，跳过本地表空间
- 本实例故障后，重新拉起需要走单机清理流程
- Temporary Extent Map处理


视图适配：

DBA_TEMP_FILES

###   [5.5 DFX设计](#55-dfx设计)  

1. 协议、驱动、访问控制、通讯、加密，不涉及；
1. 性能：使用本地SWAP表空间后，使用VM的性能与单机接近；
1. 可靠性，不涉及；
1. 主备复制，不涉及；


##   [6. TODO（遗留问题）](#6-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

1. 


## Attachments:
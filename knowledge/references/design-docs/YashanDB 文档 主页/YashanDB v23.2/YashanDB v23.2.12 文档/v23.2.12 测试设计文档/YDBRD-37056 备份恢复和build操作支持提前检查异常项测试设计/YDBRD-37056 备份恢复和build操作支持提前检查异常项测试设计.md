#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

在备份、恢复、build备库操作发起前，支持对其操作会发生中断或者失败的因素提前检查，避免过程中失败，导致浪费时间和降低体验。

SR链接:  [ ](https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?)  

  [https://pingcode.yasdb.com/pjm/items/6772469f74f36f855306b6ff?](https://pingcode.yasdb.com/pjm/items/6772469f74f36f855306b6ff?)  

#YDBRD-37056 备份恢复和build操作支持提前检查异常项

开发设计文档：  [(3431) 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67ca6693529b5c0231cce4df)    


#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

## **2.1 功能点概述**

需求来源：深圳环水

需求分析：  [ 链接 ](https://pingcode.yasdb.com/wiki/spaces/PRODUCT/pages/67514a2cd2baff0fd55a07bc)  ﻿

场 景：

1、备份时支持提前检查，以防备份到一半后发现错误导致备份失败，比如备份路径是否正确、备份磁盘大小是否足够等

2、恢复时支持提前检查，以防恢复到一半后发现错误导致恢复失败，比如恢复路径是否正确、恢复磁盘大小是否足够等

3、build database重建备库时支持提前检查，以防重建到一半后发现错误导致重建失败，比如原数据文件是否清理、redo文件是否清理等

需求描述：

备份恢复build操作支持提前检查异常项，比如备份路径错误、恢复路径错误、重建备机时datafile未清理、和build 备库redo未清理等场景——  **本需求只校验磁盘大小是否足够，恢复时是否文件有残留**

需求范围：

1、单机、分布式和集群——  **分布式不支持**

## **2.2 需求分析**

|工具|语法|说明|
|---|---|---|
|yasrman|backup [database|archivelog]   **skip validate**    format '';|校验format指定的目标备份路径磁盘空间。,23.2不支持表空间备份恢复，所以不涉及检查，回合master的时候，需要考虑适配表空间备份恢复|
|yasrman|restore  [database|archivelog]   **skip validate**   from tag 'tagname'    ** **  mapped file;,**overwrite   **  是否需要补充清理restore期间残留的文件。（只清理数据文件、ctrl。不清理归档和redo）|恢复目标路径和数据库home相关。最终磁盘空间计算为mappfile转换后磁盘|
|yasql|build database   **skip validate**   .. .    **overwrite   **  ;|主库数据文件大小和备库部署磁盘空间大小。（路径转换相关）|
|yasbak|yasbak run  --skip -validate|  [yasbak使用指导 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.4/zh/Tools-Guide/yasbak/User-Guide-for-yasbak.html)  ,![image.png](https://pingcode.yasdb.com/atlas/files/public/67eb61936a1ae92ae37377ee/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUlBQUFnQUFBQUFBQUFBQkFBUVFnQUFRQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBa0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBQUFBUUFBQUFRQUFBQUFBQUFCQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjM0MzIsImV4cCI6MTc4MjM3NDIzMn0.pFvx2Zjy4qhhJnSCCQe7wLLpZNJ1jUS4JrgCn0BUYJQ)|
|yasboot |yasboot node build --skip -validate --overwrite|br23.2版本不支持，master回合时需要适配,  [yasboot node | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.4/zh/Tools-Guide/yasboot/Introduction-to-yasboot-Command/yasboot-node.html#node-build)  ,节点nomount下执行，会清理节点下的数据文件、重启到nomount， 执行build database,![image.png](https://pingcode.yasdb.com/atlas/files/public/67eb617639823f2ac1f27351/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUlBQUFnQUFBQUFBQUFBQkFBUVFnQUFRQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBa0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBQUFBUUFBQUFRQUFBQUFBQUFCQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjM0MzIsImV4cCI6MTc4MjM3NDIzMn0.pFvx2Zjy4qhhJnSCCQe7wLLpZNJ1jUS4JrgCn0BUYJQ)|


##   [2.3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. **backup、restore命令 仅支持使用yasrman工具执行**
1. **build命令仅支持使用yasql工具执行**
1. **分布式不支持——备份恢复和build都不支持提前检查，语法未拦截**
1. **build不支持交叉部署场景**
1. **增量build和脑裂修复不支持**


# **3.测试设计**

## 3.1 测试设计方法

1. 针对新增参数，对应的语法测试，使用等价类划分法
1. 校验功能是否生效，使用场景法和错误推测法
1. 观测点：  
（1）校验使用该命令执行结果，备份不会产生备份文件，还原不会还原数据文件，build也不会建立备库
（2）校验磁盘空间、执行环境（原数据文件是否清理、redo文件是否清理）


## 3.2 详细测试设计

###  3.2.1 详细功能用例测试点

单机：在虚拟机上分机部署一主2备，N1是工具侧，N2是数据库侧

集群：在虚拟机上分机部署集群3实例；涉及到主备的场景，采用分机部署一主2备，每个集群3实例

部署形态标注单机和集群的，单机和集群都要覆盖，标注单机的，只覆盖单机即可

|序号|测试项|测试场景|部署形态|备注|
|---|:---|:---|---|---|
|1|yasrman备份提前检查：,backup [database|archivelog]   **skip validate**    format '';|构造备份磁盘空间不足（文件的实际总大小 < 磁盘剩余空间 < db预估文件总大小的120%），执行以下有效语法：,backup database  format '' tag '';——默认要提前检查异常项，备份会报错，无文件残留,backup archivelog  format '' tag '';——默认要提前检查异常项，备份会报错，无文件残留,backup database   **skip validate**    format '' tag '';——不提前检查异常项，备份成功,backup archivelog   **skip validate**    format '' tag '';——不提前检查异常项，备份成功|单机和集群|无压缩加密：预留空间按照120%计算（涉及表空间文件在备份过程中自动扩展）,压缩：按照数据文件计算大小的50%预估。,加密：文件大小基本无变化，按照120%计算,增量备份：按照50%计算,dba_backup_set中的input_size,统计内容：,![image.png](https://pingcode.yasdb.com/atlas/files/public/67eb909c6a1ae92ae373780b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUlBQUFnQUFBQUFBQUFBQkFBUVFnQUFRQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBa0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBQUFBUUFBQUFRQUFBQUFBQUFCQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjM0MzIsImV4cCI6MTc4MjM3NDIzMn0.pFvx2Zjy4qhhJnSCCQe7wLLpZNJ1jUS4JrgCn0BUYJQ)|
|2||无效语法，恢复报错：,关键字缺失或者写错,backup database   **validate **  format '' tag '';,backup database   **skip **  format '' tag '';,backup database   **skipped validate **  format '' tag '';,backup database   **skip validate space **  format '' tag '';,backup database   **skip valid **  format '' tag '';,backup archivelog    **validate **  format '' tag '';,backup archivelog   **skip space**   format '' tag '';,backup archivelog   **validate **  format '' tag '';,backup archivelog   **skipped validate **  format '' tag '';,backup archivelog   **skip valid **  format '' tag '';,backup archivelog   **skip validate space **  format '' tag '';,关键字带引号或者格式不对|单机||
|3||在yasql中执行报错,backup database   **skip validate**    format '' tag '';,backup archivelog   **skip validate**    format '' tag '';|单机||
|4||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件总大小的120%），做整库全量备份报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机和集群|业务需要覆盖各种表空间（压缩、加密），lsc表,目标文件位置：catalog下、数据库的backup目录——dest client，dest server可指定,数据文件位置：分布在多个磁盘上，比如redo在磁盘1，系统内置文件在磁盘2，自建文件在磁盘3——建文件时可指定路径,集群覆盖多DG，备份集在共享盘和本地盘|
|5||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的50%），整库压缩备份报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机和集群||
|6||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的120%），整库加密备份报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机和集群||
|7||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的50%），level 1的增量备份报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机和集群|带压缩的话是50%的50%|
|8||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的120%），归档备份（不带压缩/加密）报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机和集群|归档备份按实际的大小来，不按比例|
|9||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的50%），归档备份（带压缩）报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机和集群||
|10||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的120%），归档备份（带加密）报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机和集群||
|11|yasrman恢复提前检查：,restore  [database|archivelog]   **skip validate [space] [overwrite]**   from tag 'tagname'    ** **  mapped file;,**overwrite   **  是否需要补充清理restore期间残留的文件。（只清理数据文件、ctrl。不清理归档和redo）,(mappedfile 23.2不支持,等回合master后再补充测试)|构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），恢复有效语法：,restore database from tag 'tagname'    ** **  mapped file '' overwrite;——默认要提前检查异常项，恢复会立马报错，无文件残留,restore archivelog  ** **  from tag 'tagname'  overwrite;——默认要提前检查异常项，恢复会立马报错，无文件残留,restore  database   **skip validate**   from tag 'tagname'    ** **  mapped file  '' overwrite;——恢复中途报磁盘空间不足，有文件残留,restore archivelog   **skip validate **   from tag 'tagname'  ；——恢复中途报磁盘空间不足，有文件残留|单机和集群|**回合master的时候mapped file也要在测试下，23.2不支持restore mapped file**|
|12||无效语法，执行报错：,关键字写错或缺失,restore database   **validate **  from tag 'tagname'    ** **  mapped file  '' overwrite;,restore  database   **skip **  from tag 'tagname'    ** **  mapped file  '' overwrite;,restore  database   **skipped validate**   from tag 'tagname'    ** **  mapped file  '' overwrite;,restore database   **skip validated **  from tag 'tagname'    ** **  mapped file  '' overwrite;,restore archivelog   **skip validate space**   from tag 'tagname'    ** **  mapped file  '' overwrite;,restore archivelog   **validate **  from tag 'tagname'    ** **  mapped file  '' clean file;,关键字带引号或者格式不对|单机和集群||
|13||在yasql中执行，报错,restore  database   **skip validate**   from tag 'tagname'    ** **  mapped file  '' overwrite;,restore  database from tag 'tagname'    ** **  mapped file  '' overwrite;,restore archivelog  ** **  from tag 'tagname';|单机和集群||
|14|overwrite功能|构造恢复磁盘剩余空间（  这里计算剩余磁盘空间时，要包括将要覆盖的数据文件大小  ） = db文件实际大小，不删除某个数据文件，执行restore database from tag 'tagname'    ** **  mapped file '' overwrite;，恢复成功，runlog里会打印warning日志，需要测试是否有，日志信息是否正确|单机和集群|校验文件是否残留|
|15||构造恢复磁盘剩余空间 = db文件实际大小，不删除某个redo文件，执行restore database from tag 'tagname'    ** **  mapped file '' overwrite;，恢复成功|单机和集群||
|16||构造恢复磁盘剩余空间 = db文件实际大小，不删除某个数据文件，执行restore database from tag 'tagname'    ** **  mapped file '';不带overwrite;，恢复直接报错，无文件残留|单机和集群||
|17||构造恢复磁盘剩余空间 = db文件实际大小，不删除某个redo文件，执行restore database from tag 'tagname'    ** **  mapped file '';不带overwrite;，恢复成功|单机和集群||
|18||构造恢复磁盘剩余空间 = db文件实际大小，不删除某个数据文件，执行restore database   **skip validate **  from tag 'tagname'    ** **  mapped file '';不带overwrite;，恢复中途报错，有文件残留|单机和集群||
|19||构造恢复磁盘剩余空间 = db文件实际大小，不删除某个redo文件，执行restore database   **skip validate **  from tag 'tagname'    ** **  mapped file '';不带overwrite;，恢复成功|单机和集群||
|20||构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），使用整库全量备份集恢复立马报错（不加  **skip validate**  ），无文件残留；加了  **skip validate，恢复中途报错，有文件残留**|单机和集群||
|21||构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），使用整库压缩备份集恢复立马报错（不加  **skip validate**  ），无文件残留|单机和集群||
|22||构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），使用整库加密备份集恢复立马报错（不加  **skip validate**  ），无文件残留|单机和集群||
|23||构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），使用level 1的增量备份集恢复立马报错（不加  **skip validate**  ），无文件残留|单机和集群|归档恢复不支持overwrite，文件残留还是走已有逻辑|
|24||构造恢复磁盘空间不足（磁盘剩余空间 < 归档文件实际大小），使用归档备份（不带压缩/加密）集恢复立马报错（不加  **skip validate**  ），无文件残留|单机和集群||
|25||构造恢复磁盘空间不足（磁盘剩余空间 < 归档文件实际大小），使用归档备份（带压缩）集恢复立马报错（不加  **skip validate**  ），无文件残留|单机和集群||
|26||构造恢复磁盘空间不足（磁盘剩余空间 < 归档文件实际大小），使用归档备份（带加密）集恢复立马报错（不加  **skip validate**  ），无文件残留|单机和集群||
|27|yasql build提前检查：,build database   **skip validate [space]**   .. .    **overwrite**  ;|不删除数据文件，备机磁盘空间不足时，在备机上执行build database   **overwrite**  ;，直接报磁盘空间不足，无文件残留|单机和集群|![clipbord_1743479054067.png](https://pingcode.yasdb.com/atlas/files/public/67ebb3c939823f2ac1f27396/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUlBQUFnQUFBQUFBQUFBQkFBUVFnQUFRQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBa0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBQUFBUUFBQUFRQUFBQUFBQUFCQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjM0MzIsImV4cCI6MTc4MjM3NDIzMn0.pFvx2Zjy4qhhJnSCCQe7wLLpZNJ1jUS4JrgCn0BUYJQ)|
|28||不删除数据文件，备机磁盘空间刚好够（  这里计算剩余磁盘空间时，要包括将要覆盖的数据文件大小  ），在备机上执行build database   **overwrite**  ;成功|单机和集群||
|29||不删除数据文件，备机磁盘空间不足时，在备机上执行build database    **skip validate**     **overwrite**  ;，build到一半报磁盘空间不足，有文件残留|单机和集群||
|30|**overwrite**  功能|redo文件残留，在备机上执行build database;，不加  **overwrite，**  build直接报错errno 17，无文件残留|单机和集群||
|31||data文件残留，在备机上执行build database;，不加  **overwrite，**  build直接报错errno 17，无文件残留|单机和集群||
|32||redo文件残留，在备机上执行build database   ** overwrite**  ;，build成功|单机和集群||
|33||data文件残留，在备机上执行build database   ** overwrite**  ;，build成功|单机和集群||
|34||在主机上给2个备机同时做build，其中1个备机磁盘空间不足时，build直接报错errno 28，2个备机都无文件残留|单机|语法：BUILD DATABASE TO STANDBY (standby2, standby3);,BUILD DATABASE TO STANDBY (*);,BUILD DATABASE TO REMOTE ('127.0.0.1:2802', '127.0.0.1:2803');|
|35||redo或者data文件残留时，在主机上给2个备机同时做build，带  **overwrite**  ，build成功|单机||
|36||redo或者data文件残留时，在主机上给2个备机同时做build，不带  **overwrite**  ，build直接报错errno 17，2个备机都无文件残留|单机||
|37||在主机上给备机做增量build，带  **overwrite**  ，报错|单机||
|38||构造脑裂，在主机上给备机做脑裂build，带  **overwrite**  ，报错|单机||
|39||build新增语法测试，有效语法：,build database   **skip validate overwrite **  PARALLELISM 8 DISCONNECT FROM SESSION;,build database  ** overwrite **  PARALLELISM 8 DISCONNECT FROM SESSION;,build database   **skip validate **  PARALLELISM 8 DISCONNECT FROM SESSION;|单机和集群||
|40||build新增语法测试，无效语法：,关键字缺失或者写错,build database   **validate overwrite **  PARALLELISM 8;,build database   **skip overwrite **  PARALLELISM 8;,build database   ** skip validate  space overwrite **  PARALLELISM 8;,build database   **skipped validate overwrite **  PARALLELISM 8;,build database   **skip validatet overwrite **  PARALLELISM 8;,build database   **skip validate overwrite **  PARALLELISM 8;,build database   **skip validate clean file**  *** ***  *PARALLELISM 8;*,build database   **skip validate overwrited **  PARALLELISM 8;,关键字相对位置错误,build database  ** **  PARALLELISM 8   **skip validate overwrite**  ;,build database  ** skip validate **  PARALLELISM 8  ** overwrite**  ;|单机||
|41|yasbak备份提前检查：,yasbak run  --skip -validate --overwrite|构造备份磁盘空间不足（文件的实际总大小 < 磁盘剩余空间 < db预估文件总大小的120%），备份命令不加  **skip validate，**  做整库全量（带加密）备份报错，无文件残留；加  **skip validate，**  做整库全量备份成功|单机和集群|这里是测yasbak里调用  **skip validate [space]**  参数，做端到端的测试|
|42||构造备份磁盘空间不足（文件的实际总大小 < 磁盘剩余空间 < db预估文件大小的50%），不加  **skip validate，**  level 1的增量备份（带压缩）报错，无文件残留；加  **skip validate，**  level 1的增量备份成功|单机和集群||
|43||构造备份磁盘空间不足（文件的实际总大小 < 磁盘剩余空间 < db预估文件总大小的120%），不加  **skip validate，**  归档备份（不带压缩/加密）报错，无文件残留；加  **skip validate**  ，归档备份成功|单机和集群||
|44||yasbak备份时，指定--skip -validate --overwrite报错|单机|--skip -validate --overwrite只在yasbak恢复时，指定-b,--build-all才生效，备份时不能指定|
|45||有效语法测试：,yasbak run  --skip -validate|单机和集群||
|46||无效语法测试：,关键字缺失或者写错,yasbak run  --skipped -validate --overwrite,yasbak run  --skip -validatet --overwrite,yasbak run  -validate --overwrite,yasbak run  --skip  --overwrite,yasbak run  --s -v --overwrite,yasbak run  --skip -validate --overwriteted,yasbak run  --skip -validate --o|单机||
|47|yasbak恢复提前检查：,yasbak run  --skip -validate --overwrite|构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），恢复命令不加  **skip validate，**  用整库全量（带加密）备份集恢复立马报错，无文件残留|单机和集群|这里是测yasbak里调用  **skip validate [space]**  参数，做端到端的测试|
|48||构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），恢复命令不加  **skip validate，**  用level 1的增量备份（带压缩）集恢复立马报错，无文件残留|单机和集群||
|49||构造恢复磁盘空间不足（磁盘剩余空间 < db文件实际大小），恢复命令不加  **skip validate，**  使用归档备份（不带压缩/加密）集恢复立马报错，无文件残留|单机和集群||
|50||数据或者redo文件残留，构造恢复磁盘空间刚好足够，恢复命令加overwrite  **，**  用level 1的差量备份集恢复成功|单机和集群||
|51||数据或者redo文件残留，构造恢复磁盘空间刚好足够，恢复命令不加overwrite  **，**  用level 1的差量备份集恢复立马报错errno 17|单机和集群||
|52||备机磁盘空间不足，使用yasbak全量备份集恢复，不指定  *-b,--build-all，*  指定--skip -validate --overwrite，恢复成功，不会build备机|单机和集群|--skip -validate --overwrite只对恢复时，同时build备机生效，校验的是备机的磁盘空间是否足够，备机的文件是否存在|
|53||使用yasbak全量备份集恢复，指定  *-b,--build-all*  （指定该参数，在恢复备份时会恢复其他备节点），指定--skip -validate --overwrite，备机文件残留时，主机恢复成功，备机build成功|单机和集群|--skip -validate --overwrite 不校验备机的磁盘空间，文件可残留,--skip -validate 不校验备机的磁盘空间，文件不能残留,--overwrite 校验备机的磁盘空间，文件可残留|
|54||使用yasbak全量备份集恢复，指定  *-b,--build-all*  （指定该参数，在恢复备份时会恢复其他备节点），指定--skip -validate，备机文件残留时，主机恢复成功，备机build中途报错errno 17，nomount状态，需要重新build|单机和集群||
|55||使用yasbak增量备份集恢复，指定  *-b,--build-all*  （指定该参数，在恢复备份时会恢复其他备节点），指定--skip -validate --overwrite，主机磁盘空间足够，备机磁盘空间不足时，主机恢复成功，build中途报errno 28，有文件残留|单机和集群||
|56||使用yasbak增量备份集恢复，指定  *-b,--build-all*  （指定该参数，在恢复备份时会恢复其他备节点），指定--overwrite，主机磁盘空间足够，备机磁盘空间不足时，主机恢复成功，build立马报errno 28，无文件残留|单机和集群||
|57||使用yasbak全量备份集恢复，指定  *-b,--build-all*  （指定该参数，在恢复备份时会恢复其他备节点），指定--overwrite，备机磁盘空间刚好足够（  这里计算剩余磁盘空间时，要包括将要覆盖的数据文件大小  ），主机恢复成功，备机build成功|单机和集群||
|58|yasboot build备机提前检查  **（23.2不支持该特性，不测试；回合master时需要适配，测试）**|yasboot node build --skip -validate --overwrite，给2个备机build，其中一个磁盘空间不足，build中途报错，有文件残留|单机和集群|build的在build database 命令之后 parallelism 之前|
|59||yasboot node build --overwrite，给2个备机build，其中一个磁盘空间不足，build立马报错，无文件残留|单机和集群||
|60||yasboot node build --skip -validate --overwrite，给2个备机build，其中一个有文件残留，build成功|单机和集群||
|61||yasboot node build --skip -validate，给2个备机build，其中一个有文件残留，build中途报错|单机和集群||
|62||yasboot node build --overwrite，给2个备机build，其中一个有文件残留，build成功|单机和集群||
|63||yasboot node build 不加 --skip -validate --overwrite，给2个备机build，其中一个有文件残留，build立马报错|单机和集群||
|64||无效语法测试：,关键字写错或者缺失,yasboot node build --skipped -validate --overwrite,yasboot node build --skip -validated --overwrite,yasboot node build --skip -validate --overwritted,yasboot node build --skip --overwrite,yasboot node build -validate --overwrite,yasboot cluster build --skip -validate --overwrite|||
|65|yasrman表空间备份恢复  **（23.2不支持该特性，不测试；回合master时需要适配，测试）**|构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的120%），表空间备份（不带压缩/加密）报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机|集群不支持表空间备份恢复|
|66||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的50%），表空间备份（带压缩）报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机||
|67||构造备份磁盘空间不足（磁盘剩余空间 < db预估文件大小的120%），表空间备份（带加密）报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，备份成功|单机||
|68||构造恢复磁盘空间不足（磁盘剩余空间 < 数据文件实际大小），使用表空间备份（不带压缩/加密）集恢复立马报错（不加  **skip validate**  ），无文件残留；加  **skip validate**  ，恢复中途报错|单机||
|69||构造恢复磁盘空间不足（磁盘剩余空间 < 数据文件实际大小），使用表空间备份（带压缩）集恢复立马报错（不加  **skip validate**  ），无文件残留|单机||
|70||构造恢复磁盘空间不足（磁盘剩余空间 <  数据文件实际大小），使用表空间备份（带加密）集恢复立马报错（不加  **skip validate**  ），无文件残留|单机||
|71||表空间文件残留，恢复时不带overwrite，不加  **skip validate**  ，恢复立马报错|单机|表空间备份恢复的用例中，clean file要改成overwrite，语法部分要重新加用例校验|
|72||表空间文件残留，恢复时不带overwrite，加  **skip validate**  ，恢复中途报错|单机||
|73||表空间文件残留，恢复时带overwrite，不加  **skip validate**  ，恢复成功|单机||
|74||无效语法测试：,关键字写错或者缺失|||
|75|性能|备份和恢复的性能无下降，下降不能超过5%（10G数据量）,全heap表：下降不能超过5%,全slice表：下降不能超过40%|单机和集群||
|76|性能|build性能无下降,heap,slice|||


### 3.2.2 dfx功能涉及情况说明

|测试项|是否涉及|测试点|
|:---|:---|:---|
|CT/KT|-||
|长稳|-||
|一致性|-||
|安全|-||
|HA|是|备机备份、恢复,备机build|
|压力|-|  
|
|性能|是||
|资料|是|build、yasrman语法，yasboot build，yasbak工具等体现该需求的参数|


# 4. 测试用例



# 5. 测试框架设计

- 采用guider ha测试框架进行用例自动化
- 用例标签可参考：SELECT * FROM GUIDER.HATABLE  WHERE CASE_LABEL LIKE  '%[dep_sa_1p2s_vm]%' AND VERSION = 'master';——在属性表中查询


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|yasrman备份恢复：,在虚拟机上分机部署一主2备,在虚拟机上分机部署集群3实例,build：,在虚拟机上分机部署一主2备,在虚拟机上分机部署一主2备，每个集群3实例|


# 7. 工作量评估

工作量：4人周

计划测试完成时间：2025/4/18

会议纪要： 

参会人员: 张旭涛，高亚宁，赵楠，马爽，刘丹，马志宏

补充如下4个测试场景：

1. restore时，数据要放在不同的盘上，要能识别到不同的磁盘空间是否足够（df -h）
1. overwrite时，runlog里会打印warning日志，需要测试是否有，日志信息是否正确
1. 加skip validate，磁盘不足报errno 28；不加skip validate，会校验磁盘空间，当磁盘空间不足时，会有详细的提示说剩余空间多少，实际需要多少
1. skip validate space中的space要去掉
1. 补充备份恢复和build性能场景测试



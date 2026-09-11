Created by 陈钦卿, last modified on 一月 24, 2024

# **1. 概述**

  


# **2. 需求分析**

## 2.1需求

22.2：     [YDBRD-23732](https://jira.yasdb.com/browse/YDBRD-23732?src=confmacro)    -  客户端打包yasldr工具  完成

23.2：    [YDBRD-25044](https://jira.yasdb.com/browse/YDBRD-25044?src=confmacro)    -  【yasldr】客户端包新增导入导出工具  完成

开发设计：    [加入客户端打包 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144115602)  

参考文档：    [YashanDB Doc](https://doc.yashandb.com/yashandb/23.1/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/YashanDB%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%AE%89%E8%A3%85/00YashanDB%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%AE%89%E8%A3%85.html#YashanDB%E5%AE%A2%E6%88%B7%E7%AB%AF%E5%AE%89%E8%A3%85)  

需求来源：  华润银行数据质量监控系统----  客户的业务服务器和db的服务器是分开的，需要把业务服务器的数据导入db服务器，因客户业务服务器使用的是客户端，而客户端的包并没有含有yasldr工具

## 2.2 功能描述

将原本位于yasdb_home/bin下的yasldr、exp、imp复制到客户端的包里。

## 2.3 功能限制

  


# **3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

  


# **4. 详细设计**

|输入条件|测试场景|备注|
|---|---|---|
|客户端安装包：,linux  ----✔,rpm,windows|解压后检查bin目录下是否包含yasql、exp、imp二进制文件|（x86和arm只是机器环境不同）|
|linux：,yashandb-client-22.2.0.9-8232-g9531710-linux-x86_64.tar.gz|安装客户端，配置环境变量（PATH，  LD_LIBRARY_PATH）|疑问：服务端数据库用什么版本？未搭建数据库是否无法用yasldr？|
|rpm：,yashandb-client-22.2.0.9-1.el7.centos.x86_64.rpm|rpm安装客户端|  
|
|windows：,yashandb-client-22.2.11.102-1-g9531710f97-windows-amd64.zip|安装windows客户端|  
|
|exp导出元数据，imp导入|覆盖基本场景：,1、对象覆盖----表，视图，约束，udt等,2、导入导出方式----full/owner/tables + full/fromuser/tables|1、是否支持自动化？----理论上可以，调整框架yasdb_home为client的路径。,2、挑选存量用例进行复用,3、上传用例到工程？----可以改造工程，增加client目录，下载client包，安装后使用。,4、搭建数据库使用yasboot（对外也是使用这种方式）----也就是说需要搭建数据库,5、是否要覆盖22.2客户端+23.2服务端/22.2客户端+23.1服务端的场景？ ----主要还是验证22.2客户端+22.2服务端|
|exp导出csv数据，yasldr导入|覆盖基本场景：,1、表类型----heap/lsc/tac，分区类型----no/hash/range/list/interval/二级分区,2、数据类型全覆盖,3、lob方式,4、容错场景,5、单文件单表,6、导入模式----bulkload/nologging||
|yasldr、exp、imp命令权限|  
||
|工具字符集相关功能|命令行解析，表名、用户名、列名、文件名之类|终端设置为gbk，寻找两个字符集中不同的。|
|  
|csv为gbk，18030手动测试|  
|
|  
|分区键计算|  
|
|  
|不会影响yasql|  
|
|  
|utf8下10g数据量导入性能|  
|
|分布式不影响，简单测一下|  
|  
|


#   
  5.   **测试用例**

复用存量用例，不涉及新增。

#   
  6.   **测试框架设计**

本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux、windows|
|部署|  
|

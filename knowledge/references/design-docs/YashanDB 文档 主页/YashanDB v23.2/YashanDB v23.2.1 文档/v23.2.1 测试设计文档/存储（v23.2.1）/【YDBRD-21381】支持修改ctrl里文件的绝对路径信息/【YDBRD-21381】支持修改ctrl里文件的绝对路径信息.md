Created by 刘丹, last modified on 十一月 07, 2023

# **1. 概述**

本文描述整库拷贝后路径转换

数据库整体拷贝到其它路径后，需要修改控制文件中存储的文件绝对路径，使得数据库可以在新的路径正常启动、运行

# **2. 需求分析**

### 2.1 SR: 【23.2】    [支持修改ctrl里文件的绝对路径信息](https://jira.yasdb.com/browse/YDBRD-21381)  

链接：    [[YDBRD-21381] 【23.2】支持修改ctrl里文件的绝对路径信息 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21381)  

开发设计：    [整库拷贝后的路径转换 - 马程飞 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124262614)  

场景：  数据库整体拷贝到其他路径后，需要修改ctrl里的绝对路径，让数据库可在其他目录启动

功能：

      1.整库拷贝后配置路径转换参数，使用转换语句，可以使得数据库在新的路径正常启动

功能限制：

      1.必须在nomount状态下执行转换参数

      2.控制文件参数可以不配置或配置为新的控制文件路径

      3.三个文件路径转换参数都需要正确配置

### 2.2语法

**【转换语句】:**

ALTER      DATABASE     CONVERT   FILENAME [  INCLUDING     ARCHIVELOG  ];

指定INCLUDING ARCHIVELOG后会转换归档日志路径，默认不转换归档日志路径

*：需注意  INCLUDING     ARCHIVELOG使用与不使用的区别，如2个机器的local_archive_dest路径配置不一致，这个时候数据库能否正常open

**【配置参数】：**

|参数|说明|  
|
|---|---|---|
|  `DB_FILE_NAME_CONVERT`  |数据文件|  
|
|  `REDO_FILE_NAME_CONVERT`  |重做日志文件|  
|
|  `DB_BUCKET_NAME_CONVERT`  |bucket文件|  
|


参数配置示例：

DB_FILE_NAME_CONVERT='/data/gaoyaning/ha_home/node_2','/data/gaoyaning/ha_home/node_1','/data/gaoyaning/ha_home/node_3','/data/gaoyaning/ha_home/node_1'    
  REDO_FILE_NAME_CONVERT='/data/gaoyaning/ha_home/node_2','/data/gaoyaning/ha_home/node_1','/data/gaoyaning/ha_home/node_3','/data/gaoyaning/ha_home/node_1'    
  DB_BUCKET_NAME_CONVERT='/data/gaoyaning/ha_home/node_2','/data/gaoyaning/ha_home/node_1','/data/gaoyaning/ha_home/node_3','/data/gaoyaning/ha_home/node_1'

**【观测参数】：**

|视图名称|  
|说明|
|---|---|---|
|v$controlfile|  
|控制文件视图|
|v$logfile|  
|redo日志文件视图|
|v$datafile|  
|数据文件视图|
|v$DATABUCKET|  
|DATABUCKET视图|
|archive_local_dest|  
|归档日志|


**3. 测试**  **设计方法**   

### 3.1 特性关联领域分析：

1.部署形态：单机部署和一主两备主备部署

2.对转换语句  ALTER      DATABASE     CONVERT   FILENAME [  INCLUDING     ARCHIVELOG  ];做语法测试（正确语法，错误语法（关键字缺失、重复、拼写错误）），

3.对路径转换参数做不同的配置（配置路径与迁移路径不同、未配置3个参数），验证功能限制

4.整库拷贝后，拉起数据库业务处理正确；查询相关的视图，视图跟路径相关的字段发生改变

5.并发/testkill：路径转换与kill或者shutdown并发

6.升级场景

### **3.2 **  梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|是|
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|是|


### 3.3测试设计：

语法验证部分采用等价类划分，功能部分采用场景法

# 4.   **详细测试设计**   

### 4.1：路径转换语句和路径转换参数的语法测试

|输入条件|有效等价类|无效等价类|
|---|---|---|
|转换语句|ALTER      DATABASE     CONVERT   FILENAME   INCLUDING     ARCHIVELOG  ;,alter system [  DB_FILE_NAME_CONVERT,REDO_FILE_NAME_CONVERT,DB_BUCKET_NAME_CONVERT  ],alter system switch logfile;,转化归档日志文件|ALTER      DATABASE     CONVERT      INCLUDING     ARCHIVELOG  ;,缺少FILENAME|
|  
|  
|ALTER      DATABASE     CONVERT   FILENAME   ARCHIVELOG  ;,缺少INCLUDING|
|  
|  
|ALTER      DATABASE     CONVERT   FILENAME   INCLUDING     ;,缺少ARCHIVELOG|
|  
|  
|ALTER      DATABASE    [  CONVERT|FILENAME|INCLUDING ARCHIVELOG  ][  CONVERT|FILENAME|INCLUDING ARCHIVELOG  ]  ;,关键字重复|
|  
|  
|ALTER      DATABASE    [  COERT|FILE|INCLUDING ARCHIVE  ]  ;,关键字拼写错误|
|  
|  
|ALTER    【system|session】     CONVERT   FILENAME   INCLUDING     ARCHIVELOG  ;,DATABASE是其它参数|
|  
|ALTER      DATABASE     CONVERT   FILENAME;,alter system [  DB_FILE_NAME_CONVERT,REDO_FILE_NAME_CONVERT,DB_BUCKET_NAME_CONVERT  ],不转换归档日志文件|ALTER      DATABASE   FILENAME;,缺少CONVERT|
|  
|  
|ALTER      DATABASE   CONVERT;,缺少FILENAME|
|  
|  
|ALTER      DATABASE    [  CONVERT|FILENAME  ][  CONVERT  ]  ;,关键字重复|
|  
|  
|ALTER      DATABASE    [  COERT|FILE  ]  ;,关键字拼写错误|
|  
|  
|ALTER    【system|session】     CONVERT   FILENAME  ;,DATABASE是其它参数|


  


### 4.2：功能测试

|序号|测试场景|用例详细描述|预期|备注|
|---|---|---|---|---|
|1|整库拷贝后的路径转化|配置3个路径转换参数，并使用nomount启动，,使用正确的转化语句,打开数据库,查询视图，视图里面的路径转换|启库成功,执行SUCCEED,SUCCEED,视图里面的路径改变|  
|
|2|  
|配置3个路径转换参数，并使用mount启动，,使用正确的转化语句|启库成功,报错|这2个测试时不需要配置参数，直接把数据库切换到对应的状态|
|3|  
|配置3个路径转换参数，并使用open启动，,使用正确的转化语句|启库成功,报错|  
|
|4|  
|配置2个路径转换参数，并使用nomount启动，,使用转换语句,打开数据库报错|启库成功,成功,失败|预期需要确认|
|5|  
|配置3个路径转换参数，数据库库拷贝的路径与配置的路径不一致，并使用nomount启动|启库成功,转换语句成功,打开数据库失败|  
|
|6|  
|配置32对转换路径，并使用nomount启库，使用转换语句，打开数据库，进行查询|启库成功，视图查询正确|转换路径中有一个正确,全部错误，open报错|
||  
|配置32对转换路径，转换路径中有一个正确|启库成功|  
|
||  
|配置32对转换路径，转换路径全部错误|启库失败|  
|
|7|  
|使用alter system配置33对路径转换参数|配置失败，报错|  
|
|8|  
|路径转换参数进行递归配置，并使用nomount启动|成功|  
|
|9|  
|数据库文件不在datafiles下面，不配转换路径，启库|失败|数据文件全部在dbfiles路径下，部分在dbfiles,redo文件全部在dbfiles路径下，部分在dbfiles,dtabucket文件全部在dbfiles路径下，部分在dbfiles,考虑配不配特定的转换参数|
|10|  
|配置3个路径转换参数，配置的迁移路径空间不足，使用nomount启库|失败|  
|
|11|  
|转换前，在数据库里进行业务操作，转换成功后还可以继续正常进行业务操作|业务操作正常，转换前的业务在转换后可查|  
|
|  
|  
|数据库关闭后直接CP到其它服务器，直接nomount启动|成功|mv=cp + rm |
|12|备份恢复|转换前进行备份，转换成功后进行恢复，恢复后的数据库可以正常启动|成功|  
|
|  
|主备环境|主机上做整库拷贝路径转换，拉起主机和备机|成功|  
|
|  
|拦截测试|共享集群环境下做路径转换|失败|  
|
|  
|  
|分布式环境下做路径转换|失败|  
|
|  
|升级场景|将22.2版本和23.1版本的数据库文件复制到master版本，并拉起数据库|成功|  
|


# 5.   **测试用例**

# 6.   **测试框架设计**

采用ha_regress框架，编写python脚本执行

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[content_1686877662939.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTY4OTcwYzJhZjRmNTIwN2VlIiwicmVmX2lkIjoiNjczOTZiZTY1OTNmOTljOWZmMjM2ODBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjgxLCJleHAiOjE3ODIzODQwODF9.yje5T4xmiNdDodSudPCCFWOv9gJibKcNPoUlpRE2yAg)

 (application/x-xmind)    


[整库拷贝后的路径转换.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTdhMWFkOWEzMzExZGM4NjYxIiwicmVmX2lkIjoiNjczOTZiZTY1OTNmOTljOWZmMjM2ODBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjgxLCJleHAiOjE3ODIzODQwODF9.XhGNypZvNgY-3alZygJJai6DX2YWfb1xGCNcPnqEDTY)

 (application/x-xmind)    


[mvctrl文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTc4OTcwYzJhZjRmNTIwN2VmIiwicmVmX2lkIjoiNjczOTZiZTY1OTNmOTljOWZmMjM2ODBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjgxLCJleHAiOjE3ODIzODQwODF9.QBZYQdaN6jvwuQNBIYIpDcolrccA39H85aglabTestQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    

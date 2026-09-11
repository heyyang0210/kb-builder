Created by 高亚宁, last modified by  牛亚娜 on 十二月 20, 2023



-   [1. 概述](#id-【YDBRD13490】集群支持主备build测试设计-1.概述)  
-   [2. 需求分析  ](#id-【YDBRD13490】集群支持主备build测试设计-2.需求分析)  
    -   [2.1 SR： YDBRD-13490 - 【23.1】集群支持主备build 完成](#id-【YDBRD13490】集群支持主备build测试设计-2.1SR：SICS-CoDJira6ff23c30-90c5-3ae7-b6f1-bc933571adb4YDBRD-13490)  
    -   [2.2 功能限制](#id-【YDBRD13490】集群支持主备build测试设计-2.2功能限制)  
-   [3. 测试设计方法](#id-【YDBRD13490】集群支持主备build测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD13490】集群支持主备build测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD13490】集群支持主备build测试设计-3.2测试设计：)  
-   [4. 详细测试设计   ](#id-【YDBRD13490】集群支持主备build测试设计-4.详细测试设计)  
    -   [4.1 主备build语法测试](#id-【YDBRD13490】集群支持主备build测试设计-4.1主备build语法测试)  
    -   [4.2 主备build功能测试](#id-【YDBRD13490】集群支持主备build测试设计-4.2主备build功能测试)  
    -   [4.3 主备build并发测试](#id-【YDBRD13490】集群支持主备build测试设计-4.3主备build并发测试)  
    -   [4.4 主备build异常测试](#id-【YDBRD13490】集群支持主备build测试设计-4.4主备build异常测试)  
-   [5. 测试框架设计](#id-【YDBRD13490】集群支持主备build测试设计-5.测试框架设计)  
-   [6. 测试用例](#id-【YDBRD13490】集群支持主备build测试设计-6.测试用例)  
-   [7. 测试环境说明](#id-【YDBRD13490】集群支持主备build测试设计-7.测试环境说明)  
-   [8. 上车工程分析](#id-【YDBRD13490】集群支持主备build测试设计-8.上车工程分析)  




## 1.   **概述**

集群间支持集群主备build测试设计

## 2.   **需求分析**

### 2.1 SR：    [YDBRD-13490](https://jira.yasdb.com/browse/YDBRD-13490?src=confmacro)    -  【23.1】集群支持主备build  完成

设计文档：    [集群build 设计文档 - 张旭涛](https://conf.yasdb.com/pages/viewpage.action?pageId=117672509)  

需求规格：

1. 支持全量build
1. 不支持增量build
1. 不支持repair修复备机
1. 不支持并行build


功能：

1. 主机支持指定备机IP:PORT 执行build
1. 主机支持指定备机ID，执行build
1. 备机支持执行build database，与已连接主机执行build


![](https://pingcode.yasdb.com/atlas/files/public/673969bd8970c2af4f51fa47/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQWdBQUFBQUFBUUFBQUNBQUFBQUFBQUFBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBQUFJQ0FCQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg2MjgsImV4cCI6MTc4MjIxOTQyOH0.m1kjg9Iti_blN1nrVsdjD4Jp8rlUVQTxPTsuhrdaB7k)

主机端：build database to

remote('ip:port') [  disconnect from session  ];

               build database to standby (standyby_name) [  disconnect from session  ];

               build database to standby (*) [  disconnect from session  ];

备机端：build database；

### **2.2 功能限制**

1. 主集群端可以在任意实例执行build ，且被build的实例必须是在nomount模式下的master  0号实例角色
1. 主集群必须打开归档模式
1. 主集群下只能由一个节点给备集群执行build， 且备集群只能给一个节点执行build
1. 当前备集群只支持0号节点启动到open模式，其他节点只能启动至nomount或者不启动
1. 主集群中所有实例配置ARCHIVE_DEST_n一致，不能不配或者配置不同


## 3.   **测试设计方法**

### 3.1 特性关联领域分析：

1. 部署形态：分机部署一主一备
1. 梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点


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
|性能|是，优先级放后|
|可维护性|  
|
|资料|是|


### 3.2 测试设计：

主要采用  场景法和错误推测法进行设计

## 4.   **详细测试设计**

### 4.1   主备build  语法测试

|测试场景|有效等价类|无效等价类|备注|  
|
|---|---|---|:---|---|
|未建立链路，build database to remote('ip:port') [  disconnect from session  ];|关键字及内容正确|关键字拼写错误|  
||
|  
|关键字  大小写混合|ip:port 未加引号|  
||
|  
|  
|'ip:port' 未加括号|  
||
|  
|  
|不是英文括号，而是（【】，{}，<>，《》）|  
||
|  
|  
|ip不存在|  
||
|  
|  
|端口号被占用|  
||
|  
|  
|只有ip没有端口号|  
||
|  
|  
|('ip:port')存在特殊字符|  
||
|  
|  
|包含两个/多个备机地址|  
||
|  
|  
|括号中不是备机地址，为备机名称|  
||
|  
|  
|括号中为空/空字符串|  
||
|已建立链路，  build   database to remote('ip:port') [disconnect from session];|关键字及内容正确|括号中为备机名称|  
||
|未建立链路，build database to standby (standyby_name) [  disconnect from session  ];|  
|  
|报错||
|已建立链路，build database to standby (standyby_name) [disconnect from session];|关键字及内容正确|关键字拼写错误|  
||
|  
|关键字  大小写混合|不带括号|  
||
|  
|备机名称长度最大31|不是英文括号，而是（【】，{}，<>，《》）|  
||
|  
|  
|括号中不是备机名称，为备机地址|  
||
|  
|  
|括号中包含多个备机名称|  
||
|  
|  
|括号中为空/空字符串|  
||
|  
|  
|备机名称不存在|  
||
|  
|  
|备机已经build，再次build该备机|  
||
|未建立链路，build database to standby (*) [  disconnect from session  ];|  
|  
|报错||
|已建立链路，build database to standby (*) [  disconnect from session  ];|配置一个备机|配置多个备机|  
||
|未建立链路，备机build database;|  
|  
|报错||
|已建立链路，备机build database;|关键字正确|关键字拼写错误|  
||


### 4.2 主备build功能  测试

|  
|测试场景|预期|备注|  
|
|:---|:---|---|:---|---|
|1|未建立链路，主集群中实例都为open状态，  下发业务，  主实例执行build   database to remote('ip:port')，在各实例下发业务|创建备集群成功，但不是该主集群的备，数据不会同步|主集群已开启归档，被build的实例为nomount模式下的master  0号实例||
|2|未建立链路，主集群中主实例为open，备实例为nomount，主实例执行build   database to remote('ip:port')|创建备集群失败|主集群中所有实例必须为open状态，如果有实例为nomount/mount，会报错实例未open||
|3|未建立链路，主集群中实例都为open状态，  下发业务，  备实例执行build   database to remote('ip:port')，在各实例下发业务|创建备集群成功，但不是该主集群的备，数据不会同步|  
||
|4|未建立链路，主集群中实例都为open状态，  下发业务，  主实例执行build   database to remote('ip:port')，在各实例下发业务，然后建立链路|一段时间后，主备数据同步|  
||
|5|未建立链路，主集群中实例都为open状态，  下发业务，  备实例执行build   database to remote('ip:port')，在各实例下发业务，然后建立链路|一段时间后，主备数据同步|  
||
|6|已建立链路，主集群中实例都为open状态，  下发业务，  主实例执行build   database to remote('ip:port')  ，在各实例下发业务|主备数据同步|  
||
|7|已建立链路，主集群中主实例为open，备实例为nomount，主实例执行build   database to remote('ip:port')|创建备集群失败|  
||
|8|已建立链路，主集群中实例都为open状态，  下发业务，  备实例执行build   database to remote('ip:port')  ，在各实例下发业务|主备数据同步|  
||
|9|已建立链路，主集群中实例都为open状态，  下发业务，  主实例执行build database to standby (standyby_name)  ，在各实例下发业务|主备数据同步|  
||
|10|已建立链路，主集群中实例都为open状态，  下发业务，  备实例执行build database to standby (standyby_name)  ，在各实例下发业务|主备数据同步|  
||
|11|已建立链路，主集群中实例都为open状态，  下发业务，  主实例执行build database to standby (*)  ，在各实例下发业务|主备数据同步|  
||
|12|已建立链路，主集群中实例都为open状态，  下发业务，  备实例执行build database to standby (*)  ，在各实例下发业务|主备数据同步|  
||
|13|已建立链路，主集群各实例下发业务，备集群主实例build database|主备数据同步|  
||
|14|未建立链路，主集群中  各实例下发业务，一个实例退出，在存活实例上执行build database to remote('ip:port')，继续下发业务，然后建立链路，继续下发业务|build成功，一段时间后，主备数据同步（包含退出实例的信息）|  
|当前主备同步有问题|
|15|已建立链路，主集群中  各实例下发业务，多个实例退出，在存活实例上执行build database to remote('ip:port')，继续下发业务|build成功，主备数据同步（包含退出实例的信息）|  
|当前主备同步有问题|
|16|已建立链路，主集群中  各实例下发业务，一个实例退出，在存活实例上执行build database to standby (standyby_name)，继续下发业务|build成功，主备数据同步（包含退出实例的信息）|  
|当前有问题|
|17|已建立链路，主集群中  各实例下发业务，多个实例退出，在存活实例上执行build database to standby (*），继续下发业务|build成功，主备数据同步（包含退出实例的信息）|  
|当前有问题|
|18|已建立链路，主集群中  各实例下发业务，多个实例退出，继续在存活实例下发业务，备集群master 实例0执行build database|build成功，主备数据同步（包含退出实例的信息）|  
|当前有问题|
|19|已建立链路，主集群中  各实例下发业务，多个实例退出，然后再加入，继续下发业务，在存活实例上执行build，继续下发业务|build成功，主备数据同步|  
||
|20|已建立链路，主集群中一个实例退出，下发业务，实例再加入，继续下发业务，再次加入的实例上执行build，继续下发业务|build成功，主备数据同步|  
||
|21|未建立链路，主集群中实例  下发业务，  执行build   database to remote('ip:port') disconnect from session，在各实例下发业务|创建备集群成功，但不是该主集群的备，数据不会同步|  
||
|22|未建立链路，主集群中实例  下发业务，  执行build   database to remote('ip:port') disconnect from session，在各实例下发业务，然后建立链路|一段时间后，主备数据同步，查询  V$BACKUP_PROGRESS可能出现TYPE为BACKUP或者RESTORE|  
||
|23|已建立链路，主集群中实例  下发业务，  执行build database to standby (standyby_name)   disconnect from session  ，在各实例下发业务|主备数据同步，查询  V$BACKUP_PROGRESS可能出现TYPE为BACKUP或者RESTORE|  
||
|24|已建立链路，主集群中实例  下发业务，  执行build database to standby (*)   disconnect from session  ，在各实例下发业务|主备数据同步，查询  V$BACKUP_PROGRESS可能出现TYPE为BACKUP或者RESTORE|  
||
|25|建表空间到其他目录，主集群端配置DB_FILE_NAME_CONVERT，然后build|build成功，表现正常|  
||
|26|建表空间到其他目录，主集群端不配置DB_FILE_NAME_CONVERT，然后build|build失败，表现正常|  
||
|27|建redo到其他目录，主集群端配置REDO_FILE_NAME_CONVERT，然后build|build成功，表现正常|  
||
|28|建redo到其他目录，主集群端不配置REDO_FILE_NAME_CONVERT，然后build|build失败，表现正常|  
||
|29|build返回失败，清理残留文件后，重新build成功|build成功，表现正常|  
||


### 4.3 主备build并发测试

|  
|测试场景|预期|备注|
|:---|:---|---|:---|
|1|主集群端实例build的过程中，备集群端备实例nomount加入|build正常||
|2|主集群端实例build的过程中，备集群端备实例退出|build正常||
|3|备集群端实例build的过程中，备集群端备实例nomount加入|build正常||
|4|备集群端实例build的过程中，备集群端备实例退出|build正常||
|5|主集群端实例build的过程中，该实例退出集群|build中断||
|6|主集群端实例build的过程中，其他实例退出集群|build中断||
|7|主集群端实例build的过程中，其他实例加入集群|build中断||
|8|主集群端实例build的过程中，备集群端主实例0退出|build中断|当前有问题，实例open的过程中同时停止实例，实例停止失败，在ycs强制停止的特性中可以通过设置参数来强制停止|
|9|主集群多实例并发build|报错||
|10|备集群多实例并发build|报错||
|11|主集群端某实例build的过程中，下发文件类相关业务|报错||
|12|备集群端build的过程中，下发文件类相关业务|报错||
|13|build的过程中，进行redo增删|报错|redo增删当前未支持，支持后补测|
|14|主集群端某实例build的过程中，下发ddl/dml相关业务（非文件类）|build正常||
|15|备集群端build的过程中，下发ddl/dml相关业务（非文件类）|build正常||
|16|主集群端某实例build的过程中，删除所有实例配置的  备机链路|报错||
|17|备集群端build的过程中，删除主集群端所有实例配置的  备机链路|报错||
|18|主集群端实例build的过程中，kill该实例|build中断|当前不支持kill实例，  当前有问题|
|19|主集群端实例build的过程中，kill其他实例|build中断|当前不支持kill实例，  当前有问题|
|20|主集群端实例build的过程中，kill备集群端主实例0|build中断|当前不支持kill实例，  当前有问题|
|21|主集群端实例build的过程中，kill备集群端其他备实例|build中断|当前不支持kill实例，  当前有问题|
|22|主集群端某实例build的过程中，备集群端主实例0  执行alter database open|open报错，build成功||
|23|备集群端build的过程中，备集群端主实例0  执行alter database open|open报错，build成功||
|24|主集群端build的过程中，备集群端build|备集群报错||
|25|备集群端build的过程中，主集群端build|主集群报错||
|26|主集群端正在备份的过程中，build|报错||
|27|主集群端build的过程中，主集群端drop database|报错||
|28|主集群端build的过程中，备集群端drop database|报错||
|29|build的过程中，在主机反复切换redo产生归档|build正常，build成功后备机不会need repair||


### 4.4 主备build异常测试

|  
|测试场景|预期|备注|
|:---|:---|---|:---|
|1|主集群端build，被build的实例为mount模式下的master 实例0|报错||
|2|主集群端build，被build的实例为open模式下的master 实例0|报错||
|3|主集群端build，被build的实例为nomount模式下的master 实例1/实例2|报错||
|4|主集群端build，被build的实例为nomount模式下的非master 实例1/实例2|报错||
|5|备集群端build，build的实例为mount模式下的master 实例0|报错||
|6|备集群端build，build的实例为open模式下的master 实例0|报错||
|7|备集群端build，build的实例为nomount模式下的master 实例1/实例2|报错||
|8|备集群端build，build的实例为nomount模式下的非master 实例1/实例2|报错||
|9|备集群实例未启动，主集群端build|报错||
|10|~~一主一备时，valid_for和当前数据库角色不一样，build~~|用于级联备，集群不支持级联备|  
|


## 5.   **测试框架设计**

采用ha_regress框架，编写python脚本执行

## 6.   **测试用例**

[【YDBRD-13484】集群支持主备build-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmM4OTcwYzJhZjRmNTFmYTNmIiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.dpqs96oehzP2GM3iyeWhZ8ejoSdZJ8WLfyM-pbvKRzo)

## 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## 8.   **上车工程分析**

工程链接：    [Agile_master_L2_Build #2394 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/2394/)  

![](https://pingcode.yasdb.com/atlas/files/public/673969bd8970c2af4f51fa48/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQWdBQUFBQUFBUUFBQUNBQUFBQUFBQUFBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBQUFJQ0FCQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg2MjgsImV4cCI6MTc4MjIxOTQyOH0.m1kjg9Iti_blN1nrVsdjD4Jp8rlUVQTxPTsuhrdaB7k)

![](https://pingcode.yasdb.com/atlas/files/public/673969bd8970c2af4f51fa4a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUFBQUFBQWdBQUFBQUFBUUFBQUNBQUFBQUFBQUFBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBQUFJQ0FCQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg2MjgsImV4cCI6MTc4MjIxOTQyOH0.m1kjg9Iti_blN1nrVsdjD4Jp8rlUVQTxPTsuhrdaB7k)

|工程链接|失败用例|失败原因|解决方案|
|:---|:---|:---|:---|
|  [Agile_L2_sa_lsc_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/2215/)  |anchor_test/ha_LSC/testcase/ha_schedule1/test_yasminer_lsc.py,anchor_test/ha_LSC/testcase/ha_schedule_common/path/test_sdv_relative_path_yasminer.py|其他上车工程出现同样的失败，公共问题，大境已提单|忽略|
|  [Agile_L2_sa_tac_HA_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_1_docker/2169/)  |anchor_test/ha_TAC/testcase/ha_schedule_backup/backup_Encryption/test_backup_encryption_01.py|  [Agile_L2_sa_tac_HA_1_docker #2191 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_1_docker/2191/console)  |last fail，成功|
|  [Agile_L2_sa_heap_HA_5_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1670/)  |  
|超时,  [Agile_L2_sa_heap_HA_5_docker #1689 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1689/console)  ,  [Agile_L2_sa_heap_HA_5_docker #1693 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1693/console)  ,重新构建后，  anchor_test/ha/testcase/ha_schedule/DB_objects/ha_histogram.py失败,  [Agile_L2_sa_heap_HA_5_docker #1741 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1741/)  |忽略|
|  [Agile_L2_sa_heap_HA_6_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1729/)  |anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_01.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_02.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_03.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_04.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_06.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_09.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_10.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_09.py|原因是上车的消息流返回结果是中文，这个已经联系卢伟康处理了，等处理好了，大家重新拉起跑下last fail就行,还有一个core，已提单,  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1729/ha_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1729/ha_5freport/)  ,修复core问题后再次构建    [jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1754/ha_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1754/ha_5freport/)  ,  [Agile_L2_sa_heap_HA_6_docker #1779 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1779/)  |last fail，成功|
|  [Agile_L2_sa_heap_HA_4_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/1723/)  |~~anchor_test/ha/testcase/ha_schedule_common/index/coalesce/test_sdv_coalesce_ha_052.py~~,anchor_test/ha/testcase/ha_schedule_common/db_Privilege/system_Privilege/test_sdv_sysPrivilege_role_001.py,anchor_test/ha/testcase/ha_schedule_common/db_Privilege/system_Privilege/test_sdv_sysPrivilege_user_001.py,anchor_test/ha/testcase/ha_schedule/DB_objects/ha_role.py|1、switchover失败，再次构建成功,2、regress用户创建失败,  [Agile_L2_sa_heap_HA_4_docker #1758 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/1758/console)  |last fail，成功|
|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/53/)  |/plsql_DBMS_external/UTL_FILE/test_sdv_YDBRD_13358_utl_file_fseek_01.sql|主库该用例也失败|忽略|
|  [Agile_L2_dst_ddl_consistency](https://jenkins.yasdb.com/job/Agile_L2_dst_ddl_consistency/1049/)  |  
|超时,  [Agile_L2_dst_ddl_consistency #1068 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_ddl_consistency/1068/console)  |再次构建，成功|
|  [Agile_L2_dst_FT_yasldr_3](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_3/1060/)  |  
|构建失败，原因待分析,  [Agile_L2_dst_FT_yasldr_3 #1084 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_3/1084/console)  |再次构建，成功|
|  [Agile_L2_dst_HA_CT_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_CT_docker/1048/)  |  
|超时,  [Agile_L2_dst_HA_CT_docker #1067 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_CT_docker/1067/console)  |再次构建，成功|
|  [Agile_L2_dst_HA_Switch_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/1066/)  |  [jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/1066/Core_e5a086_e6a088/](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/1066/Core_e5a086_e6a088/)  |出现core “ankIsConsistentWrite”,已知问题，修复已经合入主干  YDBRD-17268|忽略|
|  [Agile_L2_dst_HA_FT_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_FT_docker/1065/)  |test.multicn.serial.test_sdv_role.MultiCn_Role_TestSuite#test_sdv_role_ydbrd6942_1,test.multicn.serial.test_sdv_role.MultiCn_Role_TestSuite#test_sdv_role_ydbrd6942_2|回放超时,  [Agile_L2_dst_HA_FT_docker #1099 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_FT_docker/1099/console)  |last fail，成功|
|  [Agile_L2_dst_lsc_consistency_transaction](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_consistency_transaction/1065/)  |com.transactiontest.SavepointBasicCase|  [jenkins.yasdb.com/job/Agile_L2_dst_lsc_consistency_transaction/1097/report/](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_consistency_transaction/1097/report/)  ,已知core"xaPreparePhase1Undo"|忽略|
|  [Agile_L2_dst_FT_yasldr_2](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_2/1053/)  |  
|安装部署失败，重新跑,  [Agile_L2_dst_FT_yasldr_2 #1089 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_2/1089/console)  |再次构建，成功|
|  [Agile_L2_dst_tac_FT_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_FT_docker/1138/)  |/Expect/tac/sys_view/base/test_sdv_dml_sys_view,/Expect/tac/sys_view/base/test_sdv_dml_sysviews1|视图新增字段THREAD#，DEPOSIT_THREAD#|替换预期|
|  [Agile_L2_dst_lsc_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_FT_2_docker/983/)  |/Expect/lsc/sys_view/test_sdv_sys_view_dv_desc,/Expect/lsc/sys_view/test_sdv_dml_sys_view|DV$ARCHIVED_LOG视图新增字段THREAD#，DEPOSIT_THREAD#|替换预期|
|  [Agile_L2_dst_failpoint_consistency_transaction](https://jenkins.yasdb.com/job/Agile_L2_dst_failpoint_consistency_transaction/940/)  |com.transactiontest.FailpointTestPrepared|  [Agile_L2_dst_failpoint_consistency_transaction #963 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_failpoint_consistency_transaction/963/console)  |last fail，成功|
|  [Agile_L2_cluster_heap_yasft_sa_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/106/)  |  
|构建失败,  [Agile_L2_cluster_heap_yasft_sa_case_arm #123 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/123/)  ,#154|忽略|
|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/118/)  |/dfx/cluster_audit/cluster_syn_audit/test_sdv_ydbrd_13352_cluster_audit_08.sql|主库该用例也失败，last_fail,  [Agile_L2_cluster_yasft_cluster_case_arm #134 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/134/console)  |last fail，成功|
|  [Agile_L2_cluster_yasft_ycs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/109/)  |/ycsNodeStartStop/NodeStartStop_ByMaster/test_sdv_cluster_ycs_NodeStartStop_Bymaster_scen8_dml_003.sql|超时，再次构建，用例不稳定,  [Agile_L2_cluster_yasft_ycs_arm #126 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/126/console)  ,  [Agile_L2_cluster_yasft_ycs_arm #141 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/141/)  |忽略,  
|


## Attachments:

[image2023-6-1_9-22-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmNhMWFkOWEzMzExZGM3OGI1IiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.bR_OMQBqixSmsawJYCGpsezjvOVY5zS3104QgFE9HDE)

 (image/png)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmNhMWFkOWEzMzExZGM3OGI3IiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.QYNZDEcDbgxXQkvAFwZxRC108usSikA65_GFhsEGRjg)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmM4OTcwYzJhZjRmNTFmYTQzIiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.hHRrqU23icxJ_OSPRbwUDnH4ADvCY_JYfDHYxPm-n28)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmNhMWFkOWEzMzExZGM3OGI4IiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.xZ4gMU8di8Y95WduA0Jum4avYu9nWbMITbmKuSAzEGw)

 (image/svg+xml)    


[【YDBRD-13484】集群支持主备build-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmM4OTcwYzJhZjRmNTFmYTNmIiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.dpqs96oehzP2GM3iyeWhZ8ejoSdZJ8WLfyM-pbvKRzo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-7-26_9-5-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmRhMWFkOWEzMzExZGM3OGJiIiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.mWes8BUK0yy5vro-oy5Y26_7oO4pbZO05wV7UeRc8Qs)

 (image/png)    


[image2023-7-26_9-5-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmQ4OTcwYzJhZjRmNTFmYTQ0IiwicmVmX2lkIjoiNjczOTY5YmM3MjgyMDZlZmI5MmVmNmNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjI4LCJleHAiOjE3ODIyOTUwMjh9.GQdGOW6Xs-YEapLY9_x6fsT-hXXFQVog8xcg3SBTiso)

 (image/png)    

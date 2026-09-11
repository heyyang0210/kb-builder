Created by 高亚宁, last modified on 十二月 21, 2023

## 1.   **概述**

-   [1. 概述](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-1.概述)  
-   [2. 需求分析 ](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-2.需求分析)  
    -   [2.1 SR：【23.2】增量备份集可以逐个执行restore](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-2.1SR：【23.2】增量备份集可以逐个执行restore)  
    -   [2.2 语法：](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-2.2语法：)  
-   [3. 测试设计方法 ](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-3.2测试设计：)  
-   [4. 详细测试设计   ](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-4.详细测试设计)  
    -   [4.1  语法和视图：](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-4.1语法和视图：)  
    -   [4.2  功能](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-4.2功能)  
-   [5. 测试用例](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-5.测试用例)  
-   [6. 测试框架](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-6.测试框架)  
-   [7. 测试环境](#id-【YDBRD21379】增量备份集可以逐个执行restore测试设计-7.测试环境)  


本文描述增量restore的测试设计

现状：使用增量备份集restore后，必须执行recover，如果再想恢复下一个增量备份集，只能清库，重新restore，不可以连续restore

      恢复：  RESTORE DATABASE     **[DECRYPTION password]**     FROM ‘path’ [PARALLELISM count];

                 RECOVER DATABASE;

                 ALTER DATABASE OPEN;

该需求实现后：  增量备份合并，增量备份集可以逐个执行restore，而不是一次将所有增量备份全部恢复

## 2.   **需求分析**

### 2.1 SR：  【23.2】  增量备份集可以逐个执行restore

链接：       [YDBRD-21379](https://jira.yasdb.com/browse/YDBRD-21379?src=confmacro)    -  【23.2】增量备份集可以逐个执行restore  完成

设计文档：    [增量备份合并设计文档 - 张旭涛 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124260520)      


场 景：  增量备份合并，增量备份集可以逐个执行restore，而不是一次将所有增量备份全部恢复    


功能：

1. 支持单独restore基线备份集，只恢复datafile，不恢复归档
1. 在restore某次基线备份后，可以接着restore下一个增量备份集
1. 最后一次增量备份的恢复，需要将归档和redo恢复出来，然后recover
1. 支持restore中途重启，接着restore


功能限制：

1. 首次restore， 必须为level 0的备份集。
1. 必须为同一数据库的连续增量备份集（如果restore 非连续备份集可能导致数据丢失），不能跨级restore。
1. 如果要执行连续增量restore。不可在中间环境执行recover，否则后续备份集无法在该db上继续执行restore。（达梦不可执行、）
1. restore 完成之后。db状态为 DB_RESTORE_COMPLETED ，此时可以继续执行restore，如果执行完 recover之后，db状态变为 DB_CREATE_COMPLETED，不可继续执行后续的增量备份链的增量备份
1. 若每次的restore 语句都指定noredo，恢复出来的备份集都没有redo文件和归档，无法mount。若要拉起db正常使用，最后一次restore去掉noredo参数恢复即可
1. 共享集群和yasrman不支持——拦截测试


### **2.2 语法：**

restore database incremental from ‘path’  ；——指定incremental字段， restore之后db状态为nomount

restore database  incremental noredo from ‘path’  ；——指定noredo字段， restore之后db状态为nomount，且没有恢复redo和归档文件，此时不可mount database。

可以对同一数据库做连续restore

## 3.   **测试设计方法**   

### 3.1 特性关联领域分析：

1. 部署形态：单机
1. 增量restore 语法和功能——重点
1. 视图：restore过程中怎么知道恢复进度，v$backup_progress
1. 并发/testkill：同时做增量restore，restore过程中kill重启，大数据量场景
1. 拦截测试
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
|HA|是，备机/沙箱备机上也可做增量restore|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|是|


### 3.2 测试设计：

语法部分采用等价类划分法，功能部分采用场景法

## 4.   **详细测试设计**

### 4.1    语法和视图：

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|restore database incremental from ‘path’ ;|restore database incremental from ‘path’  ；备份集为level 0的增量备份集，语法正确，恢复成功|incremental拼写错误|
|  
|incremental大小写混合|incremental位置不对|
|  
|  
|from缺失|
|  
|  
|path路径下的备份集不存在|
|  
|  
|path路径未使用引号、使用双引号|
|restore database  incremental noredo from ‘path’  ；|restore database  incremental noredo   **[DECRYPTION password] **  from ‘path’  PARALLELISM   *8*  ；备份集level 0的增量备份集，语法正确，恢复成功|noredo拼写错误|
|  
|noredo大小写混合|noredo位置不对|
|  
|  
|与DECRYPTION password参数的相对位置错误（必须放在DECRYPTION 前面）|


### 4.2  功能

|  
|测试场景|用例详细描述|预期|备注|
|:---|:---|---|---|:---|
|1|增量恢复|首次增量restore，使用level 1的备份集|restore报错|业务覆盖3种表类型|
|2|  
|首次增量restore，使用全量备份集（backup database full）|restore报错|  
|
|3|  
|首次增量restore，使用level 0的增量备份集,查看v$instance中的数据库状态|restore成功,数据库状态为started|带/不带noredo,备份集已加密/已压缩|
|4|  
|第二次增量restore，使用连续/不连续的增量备份集（考虑该备份集是否是指定tag的备份集）|使用连续的增量备份集恢复成功,使用不连续的增量备份集恢复报错|构造数据，做level 0的增量备份1a，不带independ,构造数据，做level 0的增量备份1b，带independ,构造数据，做level 1的增量备份2，基线备份指定为备份1b,构造数据，做level 1的增量备份3，不指定基线备份集（默认为1a）,构造数据，做level 1的增量备份4，基线备份指定为备份2,构造数据，做level 1的增量备份5，不指定基线备份集（默认为备份3）,备份链路：,备份1a→备份3→备份5    
  备份1b→备份2→备份4,使用增量备份1b首次恢复数据库：,1. 使用备份3做第二次恢复，报错——不报错，  2个独立备份链路的备份集之间有包含关系，这种跨链路恢复不做拦截
1. 使用备份4做第二次恢复，报错
1. 使用备份2做第二次恢复，open数据库成功，校验数据量正确
,使用增量备份1a首次恢复数据库：,1. 使用备份2做第二次恢复，报错——不报错，  2个独立备份链路的备份集之间有包含关系，这种跨链路恢复不做拦截
1. 使用备份5做第二次恢复，报错
1. 使用备份3做第二次恢复，open数据库成功，校验数据量正确
|
|5|  
|增量restore，带noredo，restore成功后，执行recover database/alter database open报错,检查归档目录和数据库文件目录,查看v$instance中的数据库状态|recover database报错,归档目录下没有归档文件，数据库文件目录下没有redo,数据库为started状态|  
|
|6|  
|首次restore后，执行recover database，再执行增量restore|再次支持增量restore报错|restore 完成之后。db状态为 DB_RESTORE_COMPLETED ，此时可以继续执行restore，如果执行完 recover之后，db状态变为 DB_CREATE_COMPLETED，不可继续执行后续的增量备份链的增量备份，状态在哪里看？？——不能看|
|7|  
|结合pitr恢复：增量restore（不带noredo） + recover数据库到某一个scn/时间点，open数据库，校验数据量|恢复成功，数据量正确|  
|
|8|  
|首次restore成功后，手段删除部分/全部旧的数据文件，再次做增量恢复报错|再次做增量恢复报错，error 2|如果删除的是redo或者归档文件，不影响,其他文件，再次恢复报错|
|9|  
|restore成功后，open数据库，做业务，再使用增量备份集restore|再次restore报错|  
|
|10|  
|连续做50次增量restore，中间带/不带noredo，最后一次不带noredo，recover，open db，校验数据量，检查是否有内存泄漏|所有增量restore都成功，数据量正确，不会内存泄漏|可用asan包|
|11|  
|使用同一个增量备份集，重复做增量restore|成功|  
|
|12|  
|备份1，2，3，使用备份3恢复后，再使用2恢复|使用2恢复报错|+++确认用例报错|
|13|  
|首次restore成功后，重启数据库至nomount状态，再次使用后续的增量备份集restore|成功|+++外场常用，重点测试，2次增量备份之间做ddl，dml，检查用例|
|14|  
|使用差量备份集连续做2次增量恢复，kill，mount重启数据库，recover，open|恢复成功，数据库正常open|2023/10/31日新增|
|15|  
|增量restore过程中构造restore失败、mount失败，recover失败，open失败|报错|  
|
|16|  
|数据库不同状态（mount/open）下执行增量restore|报错|  
|
|17|主备环境|给备机做增量恢复，恢复数据库为一个备机|成功|  
|
|18|  
|使用备机的备份集，恢复主机|  
|  
|
|19|并发|并发给一个数据库做增量restore|后执行的报错|  
|
|20|  
|增量restore过程中kill重启db,再次增量restore|增量restore报错,再次restore成功——level 0的增量备份集可能会报文件已存在，level 1的增量备份集成功|  
|
|21|拦截测试|在共享集群下做增量restore|报错|  
|
|22|  
|使用yasrman做增量restore|报错|  
|
|23|升级场景|22.2和23.1版本的增量备机集，在23.2版本做增量restore|增量restore成功|  
|
|24|+++|不同数据库的2个备份集，做增量restore|  
|  
|
|25|+++|增量restore后，recover，再增量restore|报错|  
|


补充以下场景：

做指定基线备份，备份链路为：增量0——>增量备份1（0）——>增量备份2（1）——>增量备份1a（0）——>增量备份2a（1a），括号里代表它的基线备份集

恢复路径：增量备份0——>增量备份1——>增量备份1a/2a（恢复报错）

![](https://pingcode.yasdb.com/atlas/files/public/67396be58970c2af4f5207eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ2dBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc2NDAsImV4cCI6MTc4MjMwODQ0MH0.nwndv38eH8fNELfdiAbtwL83jVMPxwZVtLg2DIZPlTI)

## 5.   **测试用例**

## 6.   **测试框架**

**使用Guider框架，不做其他框架设计**

## 7.   **测试环境**

**单机**

  


## Attachments:

[image2023-6-1_9-22-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTVhMWFkOWEzMzExZGM4NjVlIiwicmVmX2lkIjoiNjczOTZiZTU1OTNmOTljOWZmMjM2ODAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjQwLCJleHAiOjE3ODIzODQwNDB9._zaLrzlw4mo69xUvP4RgVb0JlWJzU4oJbGiVufBSzxY)

 (image/png)    


[YDBRD21379增量逐个恢复测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTVhMWFkOWEzMzExZGM4NjYwIiwicmVmX2lkIjoiNjczOTZiZTU1OTNmOTljOWZmMjM2ODAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjQwLCJleHAiOjE3ODIzODQwNDB9.eEJbo4v2jgxtyZ8VLxK9cOKTBNzS-wz_stMW3dp64B0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    

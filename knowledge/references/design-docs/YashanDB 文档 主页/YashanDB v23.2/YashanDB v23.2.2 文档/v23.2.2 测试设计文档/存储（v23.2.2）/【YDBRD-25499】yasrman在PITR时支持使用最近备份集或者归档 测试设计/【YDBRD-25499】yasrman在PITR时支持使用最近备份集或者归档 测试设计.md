Created by 高亚宁, last modified on 四月 24, 2024

## 1.   **概述**

-   [1. 概述](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-1.概述)  
-   [2. 需求分析 ](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-2.需求分析)  
    -   [2.1 SR：yasrman在PITR时自动搜索备份集](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-2.1SR：yasrman在PITR时自动搜索备份集)  
    -   [2.2 语法：](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-2.2语法：)  
-   [3. 测试设计方法 ](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-3.2测试设计：)  
-   [4. 详细测试设计   ](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-4.详细测试设计)  
    -   [4.1  语法：yasrman恢复](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-4.1语法：yasrman恢复)  
    -   [4.2  功能](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-4.2功能)  


1.   [5. 测试用例](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-5.测试用例)  


1.   [6. 测试框架设计](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-6.测试框架设计)  


1.   [7. 测试环境说明](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-7.测试环境说明)  
1.     -   [8. 工作量评估](#id-【YDBRD25499】yasrman在PITR时支持使用最近备份集或者归档测试设计-8.工作量评估)  



本文描述yasrman在PITR时支持使用最近备份集或者归档的测试设计

现状：必须先选择一个较早的数据库备份集，恢复后，再恢复归档日志，再执行PITR的recovery

该需求实现后：pirt恢复时，不需要指定备份集tag，  用户只需要输入目标时间或者scn，yasrman就会自动找最近的备份集和需要的归档进行恢复    


## 2.   **需求分析**

### 2.1 SR：  yasrman在PITR时自动搜索备份集

链接：        [YDBRD-26669](https://jira.yasdb.com/browse/YDBRD-26669?src=confmacro)    -  yasrman在PITR时自动搜索备份集  设计中

设计文档：    [PITR自动搜索备份集特性设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144124780)      


场 景：  restore database plus archivelog until scn/time    


功能：  yasrman在PITR时支持使用最近备份集或者归档，用户只需要输入时间和db id，yasrman就会自动找最近的备份集和需要的归档

需求范围：单机和集群——分布式不支持pitr，不需要支持

规格：

1. PITR执行时，会尽可能复用数据库本地的归档，以便尽可能恢复到目标点
1. until time的目标时间，如果最终恢复的时间误差小于1s，则不报错。即until time允许有1s的误差
1. database id为正数


约束：

1. 不支持分布式部署；
1. 自动查找的数据库备份集和归档备份集，必须是通过yasrman备份的。SQL命令执行的备份集无法自动扫描
1. yasql不支持，要拦截


### **2.2 语法：**

![](https://pingcode.yasdb.com/atlas/files/public/67396cba8970c2af4f520e16/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMwMzMsImV4cCI6MTc4MjMxMzgzM30.PNY3rY5FO_VTFvoPsk3-Bpyl2Tt2tMWlIq-6BwnRs4I)

其中DBID是指定数据库的ID，数据库ID在建库后就不会变化，即使进行了备份恢复操作也不会变，这个是为了区分多个数据库的备份集。

如果不指定DBID，则只会选择scn最接近目标scn的备份集。指定DBID后，只会搜索相同DBID的备份集。

## 3.   **测试设计方法**   

### 3.1 特性关联领域分析：

1. 部署形态：单机、集群
1. restore database新增2个语法分支，语法部分测试，有效语法全部覆盖，无效语法覆盖常见语法错误
1. pitr恢复时，自动查找  最接近目标scn/time的备份集恢复，备份集包括整库备份集、归档备份集，需要重点考虑以下几个方面：
    1. 能不能找到符合条件的备份集——一个catalog中包含多个数据库的备份集，指定dbid的时候找的是指定数据库的备份集，若不指定dbid，找的是最接近目标scn/time的备份集
    1. 查找的备份集对不对，是不是最接近目标scn/time的备份集——查询dba_backup_set和dba_archive_backupset视图判断scn是否是最接近的，也可通过恢复出来的数据量多少判断
    1. 目标归档是否已全部备份，如果没有，需要复用本地归档，本地归档的来源可以copy备机的，需要校验本地归档是否正确
    1. 恢复后的数据是否正确
    1. 异常处理：归档备份集之间有空洞；timestamp到scn的转换，依赖于时区，备份集的时区和pitr恢复的时区不一致；恢复加密备份集时，多个备份集的密码不一致；回放不到指定时间点时怎么办？能否正常open？
1. 梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点


|专项|是否涉及|
|:---|:---|
|并发|  
|
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
|升级场景|是|


### 3.2 测试设计：

语法部分采用等价类划分法，功能部分采用场景法

## 4.   **详细测试设计**

### 4.1      语法：yasrman恢复

前置条件：数据库文件已删除，数据库处于nomount状态

|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|---|
|restore database until time/scn  retore_parameters|restore database until time retore_parameters（所有恢复属性全覆盖，除tag和format）|关键字缺失：,until缺失,time/scn缺失,时间或者scn缺失|  
|
|  
|restore database until scn retore_parameters（所有恢复属性全覆盖，除tag和format）|指定format报错|  
|
|  
|  
|time/scn不合法：,time/scn过大,time/scn过小,time/scn为时间函数,time精确到微秒,scn为小数/负数,scn为字符串|  
|
|  
|  
|在yasql中执行该语句，报错|  
|
|restore database dbid database_id until time/scn  retore_parameters|restore database dbid database_id until time  retore_parameters（所有属性全覆盖，除tag和format），dbid正确|dbid错误：,dbid不存在,dbid为小数,dbid为负数,dbid为0,dbid为字符串，里面的值正确,dbid为空，null，空串|dbid为BIGINT类型|
|  
|restore database dbid database_id until scn  retore_parameters（所有属性全覆盖，除tag和format），dbid正确|dbid相对位置错误|  
|
|  
|  
|dbid关键字缺失或者写错|  
|
|  
|  
|指定tag/format|  
|
|  
|  
|在yasql中执行该语句，报错|  
|
|  
|  
|指定DBID，不带Until SCN/TIME报错|  
|
|指定tag做pitr恢复|其他需求已覆盖|  
|  
|


### 4.2  功能

|  
|测试场景|用例详细描述|预期|备注|  
|
|:---|:---|:---|:---|:---|---|
|1|单机pitr自动搜索备份集|catalog中有3个库的多个备份集（全库、归档），目标scn/time内的归档都在备份集里,不指定dbid until scn恢复，查找到的备份集为scn最接近的全量备份集+归档备份集（多个）|恢复的是最接近scn目标的备份集成功,查找的备份集正确，数据量正确|构造数据时考虑三种表类型，redo和表空间，slice文件等,备份集不加密，其他属性全部带,+slice文件不支持pitr——可能丢失    |✔|
|2|  
|catalog中有3个库的多个备份集（全库、归档），目标scn/time内的归档都在备份集里,不指定dbid until time恢复，查找到的备份集为time最接近的全量备份集+归档备份集|恢复的是最接近time目标的备份集成功,查找的备份集正确，数据量正确|备份集加密，密码正确                      |✔|
|3|  
|catalog中有3个库的多个备份集（全库、归档），目标scn/time内的归档都在备份集里,指定dbid until scn恢复，查找到的备份集为scn最接近的增量备份集+归档备份集|恢复指定的备份集成功,查找的备份集正确，数据量正确|构造多个备份集，密码不同的场景——找的应该是密码一致的最接近目标scn的备份集|✔|
|4|  
|catalog中有3个库的多个备份集（全库、归档），目标scn/time内的归档都在备份集里,指定dbid until time恢复，查找到的备份集为time最接近的差量备份集+归档备份集|恢复指定的备份集成功,查找的备份集正确，数据量正确|  
|✔|
|5|  
|catalog中有3个库的多个备份集（全库、归档），目标scn/time内的归档全部在本地,指定dbid until scn恢复，查找到的备份集为scn最接近的增量备份集|会复用本地归档，恢复成功,查找的备份集正确，数据量正确|  
|✔|
|6|  
|catalog中有3个库的多个备份集（全库、归档），目标scn/time内的归档在多个归档备份集+本地归档（包含注册的归档文件）里,指定dbid until scn恢复，查找到的备份集为scn最接近的增量备份集|会恢复归档备份集里的归档+复用本地归档，恢复成功,查询的备份集正确，数据量正确|沙箱备机备份，注册归档，指定  scn   做  pitr  恢复，指定  DBID until time  恢复   (  单机场景  )|归档注册只可在沙箱备机下做注册，与catalog中3个库多个备份集场景冲突|
|7|  
|catalog中有3个库的多个备份集（全库、归档），目标scn/time内的归档文件中间有空洞,指定dbid until scn恢复，open数据库|恢复报错,yasql能正常open|  
|✔  |
|8|  
|指定dbid until scn恢复，指定的scn过大,open resetlogs数据库|恢复报错，会显示恢复到哪个位置,yasql open成功，数据恢复到哪里是哪里|  
|✔  |
|9|  
|指定dbid until scn恢复，指定的time过大,open resetlogs数据库|恢复报错，会显示恢复到哪个位置,yasql open成功，数据恢复到哪里是哪里|  
|✔|
|10|  
|指定dbid until scn恢复失败后，yasql open时不加resetlogs|open报错|  
|✔|
|11|  
|指定dbid until scn恢复时，解密密码不对，找不到符合条件的备份集|恢复报错|  
|✔|
|12|  
|执行过restore之后，没有进行全库备份，但是备份了归档，PITR指定了restore之后的时间，进行恢复|报错，恢复不到目标点|restore之后产生的归档，restore time和之前的备份集无法匹配，因此restore之后产生的归档无法恢复|✔  |
|13|  
|存在归档备份，全库备份集被删除，指定dbid until time恢复|报错，找不到备份集|  
|✔|
|14|+|备份集的时区和恢复的时区不一致时，恢复时间正确/错误|恢复时间时区正确，成功（默认备份恢复时区一致 已覆盖),恢复时间时区错误，报错|  
|✔|
|15|+|使用yasrman做level 0的增量备份A，再使用yasrman做level 1的增量备份B，使用yasql做level 1的增量备份C和归档备份，再使用yasrman做level 1的增量备份D和归档备份，获取当前的scnA，pitr恢复到scnA|恢复成功|yasrman pitr恢复，只搜索yasrman的备份集|✔,  
|
|16|集群pitr自动搜索备份集|集群三实例下，覆盖以上场景|  
|构造数据考虑集群多实例，每个实例都要做业务|  
|
|17|  
|pitr restore非master节点|报错|只能restore master节点|  
|
|18|  
|集群下，考虑备份集在不同的存储上（普通盘和共享盘）|恢复成功|  
|  
|
|19|升级场景|~~22.2和23.1版本的增量备份集，升级到23.2.100版本，升级前后使用该功能做pitr恢复~~,~~(备注操作流程：1.   升级前 建表插入数据checkpoint 切日志，做增量level 0备份，补充数据checkpoint 切日志，做增量level 1备份并记录Sequence/time，做归档备份，pitr恢复报错~~,~~2.. 升级后，根据升级前的获取的TIME  做pitr  until time恢复~~|~~升级前恢复报错~~,~~升级后恢复成功~~|~~系统表兼容，备份集不兼容~~,~~主要测语法~~|不允许通过备份恢复操作做数据库升级，备份恢复也不测升级场景，只测dba视图、备份权限相关的|


# 5.   **测试用例**

测试设计细化后的文本用例

# 6.   **测试框架设计**

使用已有的ha_regress测试框架

  [https://git.yasdb.com/cod-x/anchor_regress/-/tree/master/ha_regress](https://git.yasdb.com/cod-x/anchor_regress/-/tree/master/ha_regress)  

# 7.   **测试环境说明**

使用linux操作系统安装yasdb， 对于环境配置无要求

## **8. 工作量评估**

总计10人天：

测试设计+评审：2人天

单机：3.5人天

集群：3人天

上车+CI分析：1人天——已合入，不需要上车

## Attachments:

[image2024-4-10_17-46-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmE4OTcwYzJhZjRmNTIwZTE0IiwicmVmX2lkIjoiNjczOTZjYmE3MjgyMDZlZmI5MmYxNjMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDMzLCJleHAiOjE3ODIzODk0MzN9.XH3G-bUMA33B5mCPRJfZJGcbLc10R4Oq_84prMifLTU)

 (image/png)    


[YDBRD-26669yasrman在PITR时自动搜索备份集文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmE4OTcwYzJhZjRmNTIwZTE1IiwicmVmX2lkIjoiNjczOTZjYmE3MjgyMDZlZmI5MmYxNjMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDMzLCJleHAiOjE3ODIzODk0MzN9.IloVRtJfWA33mSK5LNnFFhZiGguHAcEuCnPEwmy7mMU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-4-24_17-10-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmFhMWFkOWEzMzExZGM4Yzg1IiwicmVmX2lkIjoiNjczOTZjYmE3MjgyMDZlZmI5MmYxNjMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDMzLCJleHAiOjE3ODIzODk0MzN9.YXHh4-zgy-kn42fjbdYGdC9KDKY2KF-aLhSxdAsdjig)

 (image/png)    


## Comments:

|  [](null)  ,该特性属于成熟模块的小特性，因此概要设计和详细设计合一,Posted by gaoyaning at 四月 03, 2024 09:09|
|---|
|  [](null)  ,与会人：马志宏、张旭涛、高亚宁、刘丹、刘大境    
  会议时间：2024.04.06    
  会议地点：线下会议,会议纪要：,1. 单机和集群的功能测试保持一致’
1. slice不支持pitr，slice文件恢复不全等问题。
1. 新增测试点：  备份集的时区和恢复的时区不一致时，恢复时间正确/错误
1. 新增测试点：使用yasrman做level 0的增量备份A，再使用yasrman做level 1的增量备份B，使用yasql做level 1的增量备份C和归档备份，再使用yasrman做level 1的增量备份D和归档备份，获取当前的scnA，pitr恢复到scnA
,Posted by gaoyaning at 四月 08, 2024 14:15|
|  [](null)  ,不允许通过备份恢复操作做数据库升级，备份恢复也不测升级场景，只测dba视图、备份权限相关的,Posted by gaoyaning at 四月 23, 2024 16:57|

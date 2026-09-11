Created by 陈瑞, last modified on 十一月 30, 2023

# 1. 概述

tpcc受undo空间分配的优化

# 2. 需求分析

## 2.1 功能点分析

  [[YDBRD-21745] TPCC模型下的undo机制优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21745?filter=-1)  

  [Undo对TPCC性能的影响分析 - 苏凡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133579782)  

  [Undo对TPCC性能的影响分析 - YashanDB存储引擎 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133571573)  

- undo从表空间申请机制变化


|  
|原机制|优化后|
|---|---|---|
|undo从表空间申请机制变化|    原机制，分配undo的时候若本segment无法分配，会直接进入表空间分配流程；加锁之后在表空间内扫描，才能知道表空间也分配不出页面；这一过程中，表空间的锁冲突很严重。|在未开启自动扩展的场景下，当首次发现表空间已无空闲页面时，打上表空间full标记；,后续除非表空间新增文件、后台回收页面至一定程度等情况，都不再尝试加锁从表空间申请。|
|undo申请动态extent size|    undo每次分配页面，固定从表空间申请16个；  在大冲突下，16个页面不够使用，假设分配160个页面需要10次表空间分配流程，10次表空间加锁，压测下冲突较大|根据该事务统计的大致消耗速率进行估算，动态分配，分配范围分别为16,128,1024；|
|undo steal优化|    steal大量发生时，存在两种情况，一是之前按顺序steal，导致编号靠前的undo segment，被大量占用回收，造成快照太旧问题；,二是segment冲突很大，之前在非normal模式下steal，加上锁才能判断是否可以steal，造成大量无谓的锁冲突；|降低锁冲突，每次无锁扫描选出一个segment进行steal|


## 2.2 应用场景

- tpcc模型下性能场景
- 不同参数和配置下，触发undo空间申请机制


## 2.3 规格约束

- 转测范围 单机/集群


## 2.4 相关视图

视图不属于该次转测范围，但是可以用来观测场景构造是否成功

# V$UNDOSTAT

|字段|类型|说明|
|---|---|---|
|ID|INTEGER|undo segment ID|
|BLK_REUSE|INTEGER|从blocklist复用undo block的次数|
|STEAL|INTEGER|尝试去其他segment窃取已过期block的次数|
|DEGRADE_STEAL|INTEGER|尝试去其他segment降级窃取未过期block的次数|
|FORCE_STEAL|INTEGER|尝试去其他segment强制窃取未过期block的次数|
|STEALED|INTEGER|被其他segment窃取已过期block的次数|
|DEGRADE_STEALED|INTEGER|被其他segment降级窃取未过期block的次数|
|FORCE_STEALED|INTEGER|被其他segment强制窃取未过期block的次数|
|BALANCE_TIME|DATE|上一次发生后台undo自动均衡优化的时间|
|BALANCE|INTEGER|发生后台undo自动均衡优化的次数|
|BALANCE_BLK|INTEGER|undo自动均衡优化一共从segment归还给表空间的block个数|
|RECYCLE_TIME|DATE|上一次发生后台回收的时间|
|RECYCLE_UFB|INTEGER|后台回收未初始化block的次数|
|RECYCLE_LIST|INTEGER|后台回收blocklist的次数|
|RECYCLE_LIST_BLK|INTEGER|后台回收本segment上blocklist时总共回收的block个数|
|RECYCLE_REQ|INTEGER|segment发起回收请求的次数|
|GET_RECYCLED_LIST|INTEGER|segment发起回收请求后，回收其他segment的blocklist的次数|
|GET_LIST_BLK|INTEGER|segment发起回收请求后，从其他segment的blocklist上回收到的block个数|


  


# V$UNDO_SEGMENTS

|字段|类型|说明|
|---|---|---|
|ID|BIGINT|segment ID|
|USED_TIME|DATE|undo segment上被已提交事务归还的block中，第一个undo block所在的事务提交的时间|
|SURPLUS_COUNT|INTEGER|在保持undo链自动均衡优化的情况下多余的block数量|
|UBLK_COUNT|INTEGER|已提交事务归还的undo block数量|
|FIRST_UBAFIL|INTEGER|已提交事务归还的第一个undo block的文件编号|
|FIRST_UBABLK|INTEGER|已提交事务归还的第一个undo block的ID|
|LAST_UBAFIL|INTEGER|已提交事务归还的最后一个undo block的文件编号|
|LAST_UBABLK|INTEGER|已提交事务归还的最后一个undo block的ID|
|UFB_COUNT|INTEGER|未初始化的undo block数量|
|FIRST_UFBFIL|INTEGER|第一个未初始化的undo block的文件编号|
|FIRST_UFBBLK|INTEGER|第一个未初始化的undo block的ID|
|XBLKS|INTEGER|undo segment管理的事务block数量（保留字段）|


# V$DATAFILE

关键字段

|FREE_BLOCKS|INTEGER|数据文件内空闲可用的数据块数量|
|---|---|---|


  


# 3. 详细测试设计

## 3.1 测试设计方法

## 参数变量

|  
|默认值|说明|
|---|---|---|
|UNDO_RETENTION|（默认 300s）|指定undo block从事务提交那一刻开始被保留的时间|
|undo segment数量|（默认64）|64~256|
|_UNDO_FORCE_RETENTION|    false|是否开启undo强制保留,当开启undo强制保留时，则可以保证事务提交那一刻起，其undo block强制保证保留UNDO_RETENTION时间，此时间内的undo block一定可以访问。|
|databuffer大小|正常配置环境75%|  
|
|UNDO_SHRINK_INTERVAL|默认3600s|- 后台undo balance功能的时间间隔。如果未发现性能问题，建议使用默认值。
- 取值范围/格式：[0,4294967295]，且必须大于UNDO_RETENTION
|
|UNDO_SHRINK_ENABLED|默认开启|  
|


UNDO_SHRINK_INTERVAL：后台运行。可以调小

  


1、针对优化点1：

测试思路：

- retention设置较大
- 不开启表空间自动扩展，使表空间耗尽
- 在undo表空间本身不足的情况下(查询datafiles字段FREE_BLOCKS 为0)，  比对旧版本和新版本的  tpmc优化


a. 测试不同retention 参数下。对比旧版本与新版本tpmc

b.测试不同segment数量下下。对比旧版本与新版本tpmc

  


观测手段:       查询select * from v$datafile where id >=5; 查询字段FREE_BLOCKS 为0

  


  


  


2、针对优化点2

undo每次分配页面，固定从表空间申请16个；  根据该事务统计的大致消耗速率进行估算，动态分配，分配范围分别为16,128,1024；(无实际的观测手段)

测试思路：

- 表空间设置较大或开启表空间扩展，使业务压力下，未分配完所有space，block处于平衡。一直在不断申请页面中，和回收页面


a. 测试不同retention 参数下。对比旧版本与新版本tpmc

b.测试不同segment数量下下。对比旧版本与新版本tpmc

  


  

  


3、  undo steal优化：降低锁冲突，每次无锁扫描选出一个segmengt进行steal

normal steal/degree steal/force steal

测试思路：

- 不开启表空间自动扩展
- 增加业务压力，  对比旧版本与新版本tpmc


a.测试不同并发下。对比旧版本与新版本tpmc

  


4、其他场景

1、_UNDO_FORCE_RETENTION=true 性能比对

2、ci上参数调优过后的单机/集群性能 性能比对

3、相对undo表空间大小减小 databuffer 性能比对

  


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|是|
|可维护性|否|


  


性能场景参数

1000仓 ：跑每日ci场景，跑完

100仓：其他场景，15-30分钟

|  
|表空间大小（推荐  配置undo表空间的大小最大为data buffer的1/5  ）|自动扩展|retention（默认300）|_UNDO_FORCE_RETENTION（默认false）|segment 数量|databuffer 大小|
|---|---|---|---|---|---|---|
|1|30G|开启|30|FALSE|64|100G|
|2|30G(UNDO表空间有剩余)|不开启|900|false|64|200G|
|3|15G|不开启|900,UNDO_SHRINK_INTERVAL=3600|false|64|200G|
|4|10G（undo表空间无剩余）|  
|  
|  
|  
|  
|
|6|4G|  
|  
|  
|  
|  
|
|7|10G|不开启|900|false|64|200G|
|20|30G(UNDO表空间有剩余）|开启|3600,UNDO_SHRINK_INTERVAL= 3601|false|64|200G|
|21|  
|  
|900|  
|  
|  
|
|22|  
|  
|400|  
|  
|  
|
|23|  
|  
|50|  
|  
|  
|
|25|20G(UNDO表空间有剩余）|开启|300|false|64|  
|
|26|  
|  
|  
|  
|128|  
|
|27|  
|  
|  
|  
|192|  
|
|29|10G（undo表空间无剩余）|不开启|900|  
|  
|  
|
|32|10G|开启|300|false|64|100G|
|33|  
|  
|  
|  
|  
|50G|
|36 ci上参数调优过后的单机/集群性能  ,单机,master和特性包均为为：115 万,![](https://pingcode.yasdb.com/atlas/files/public/67396be2a1ad9a3311dc8632/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJLQUFDQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc1ODAsImV4cCI6MTc4MjMwODM4MH0.xcqHln1xm8Hq-IzaNMEoNFubLKIQ7LjOqF_Pfe0GWis),  
,集群无下降,![](https://pingcode.yasdb.com/atlas/files/public/67396be28970c2af4f5207be/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJLQUFDQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc1ODAsImV4cCI6MTc4MjMwODM4MH0.xcqHln1xm8Hq-IzaNMEoNFubLKIQ7LjOqF_Pfe0GWis),  
,  
,  
,  
|||||||
|37|10G|不开启|300|true|64|200G|
|1、  当首次发现表空间已无空闲页面时，打上表空间full标记,- 增加文件
- 扩大表空间文件resize 
- 删除undo数据文件 --报错
,2、自动扩展关闭，然后不停申请（发生steal），所有事务不提交，直到占满表空间no free undo blocks,- 提交未提交的事务不报错
,3、存量的2层功能用例正常,4、1、UNDO_SHRINK_INTERVAL=30,     2、UNDO_SHRINK_ENABLED=true,调小，隔一段时间观察是否能申请页面。查v$datafile,5、segment 最小：锁冲突严重，并发数比较大|||||||


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 用例多为性能场景，自动化用例和编写代价较大，不自动化。
- CI有正常性能看护工程


# 6. 测试环境说明

*测试环境：2台高配置物理机*

*操作系统：x86*

*环境配置：测试以单机部署为主。集群环境跑最终调优后的ci工程*

*测试工具：tpcc*

# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2023、11、21

## Attachments:

[my_result_2023-11-26_182940_36_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTBhMWFkOWEzMzExZGM4NjBkIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.NuSpYl9i3mCHKNoYWvZiwRdMK2mlIT7rWdJPhfvIIaU)

 (image/png)    


[my_result_2023-11-26_160455_36_master——.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTA4OTcwYzJhZjRmNTIwNzk5IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.hVOCJ8IwWRFHDzrQ1JGty7KlwDYQLNulXyNNIpD0yIc)

 (image/png)    


[my_result_2023-11-26_181546_37_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTA4OTcwYzJhZjRmNTIwNzliIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.rwPKihhFrW14yvgIG9SJAJQ06dlVvy5Q0KFvdTpnl3g)

 (image/png)    


[my_result_2023-11-26_160455_36_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTBhMWFkOWEzMzExZGM4NjBlIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.rWH034dk-BA5lxy3r3XU2NaBuwIL3wNZcQbTzWk1b3E)

 (image/png)    


[tpm_nopm.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTA4OTcwYzJhZjRmNTIwNzlkIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.OwyMCxWCYcIkvvIwR0Bh4QZEK_qidqStfmsXO6bCvhA)

 (image/png)    


[my_result_2023-11-26_135252_29_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTA4OTcwYzJhZjRmNTIwNzllIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.fJZ7-p-VEOWNG0z_PkC5qtloTRx1JA8oX6kwSkAt9Zs)

 (image/png)    


[my_result_2023-11-26_123811_29_maste.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTA4OTcwYzJhZjRmNTIwNzlmIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.JJCAeAPRUC7MnIGLlPWAr8rH02LC4yqX0lPr2ExOre4)

 (image/png)    


[my_result_2023-11-22_115813_27_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjE0IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.yEv7ZpaRX4KkbxYRsAfWrwPphCEdfe1mWjfImqA-6G0)

 (image/png)    


[my_result_2023-11-22_104326_27_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTE4OTcwYzJhZjRmNTIwN2EyIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.ts3RamMd2b2qAJZiICbUb1jidaGIh2UAEbUDx0IDTBg)

 (image/png)    


[my_result_2023-11-21_163634_25_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjE1IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.43KHAeRwuyavjtJufcEEFLbcS4TLKgBZNJhzUybouCs)

 (image/png)    


[my_result_2023-11-22_111428_32_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjE3IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.kkwQZv5ikFXpeYPipJUv9zdBo9HkVUhVYZ7yKaBkwfA)

 (image/png)    


[my_result_2023-11-22_170528_33_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTE4OTcwYzJhZjRmNTIwN2E2IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.itV5-UoWubgtpPnwZ0DG1q4CRMJUtyZggdlK29LGhGQ)

 (image/png)    


[my_result_2023-11-22_152059_33_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjE4IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.yMk6khE4CtEuCfTIYeMoyBpozRZyiEQweXzFhqGxNE8)

 (image/png)    


[my_result_2023-11-22_130054_32_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjFhIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.phNKDbKvh1tIObcLSGhvso3KaUzi_F7hxoFoXTVZ59g)

 (image/png)    


[my_result_2023-11-21_154055_06_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjFiIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.8Xp2sEqZF_iVxbX9lrko4EQtXYqcoWLqkUa9jR9jlxo)

 (image/png)    


[my_result_2023-11-21_222734_26_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjFjIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.8HYP8m-zD-UdY1GjHDvBWHs3hyPZZ8r8D33zgkfM_tc)

 (image/png)    


[my_result_2023-11-21_234120_26_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjFlIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.MMx0iILMDDULPs-f-H4kBSq9Q6mO47nsLNr0hPwt37c)

 (image/png)    


[my_result_2023-11-21_121807_23_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjFmIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.7zTCbI381DeZb4QaGn606ABy62VjYhJ6_DDXjXq3dfw)

 (image/png)    


[my_result_2023-11-21_110133_23_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTE4OTcwYzJhZjRmNTIwN2FiIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.0bdFKPOrDXwxym6iOMeudc4V7HbQ0XYCAuAKtayepQE)

 (image/png)    


[my_result_2023-11-21_112604_04_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjIxIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.b1QYxw4rAcMfEDVXwaalPWCqB9S1t0LGIGs1dBWzMnc)

 (image/png)    


[my_result_2023-11-20_202423_22_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjIzIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.NO81h_BdDraUtkIbnS7lStdSCzn_KgdEzhEa3hsR86o)

 (image/png)    


[my_result_2023-11-20_213929_22_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTE4OTcwYzJhZjRmNTIwN2FkIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.11c3J7uWGZO7gFHBkR7hqg0jCUuEMTv8htotlFp9eaw)

 (image/png)    


[my_result_2023-11-20_191321_04_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTFhMWFkOWEzMzExZGM4NjI0IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.XqHCNdw_xq3Obpd94pHEutpMZ9cT0tjG6PdtAxZNuRo)

 (image/png)    


[my_result_2023-11-20_165332_21_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTJhMWFkOWEzMzExZGM4NjI1IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.go8_VVrNMnylDxn8visJOW24sMj7CFbna5v9o4BYt0M)

 (image/png)    


[my_result_2023-11-20_185024_21_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTI4OTcwYzJhZjRmNTIwN2IxIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.xcAppmu--MsemyHIwWxsujiSw2AJzHyy51Xcea11Rtw)

 (image/png)    


[my_result_2023-11-20_154931_03_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTJhMWFkOWEzMzExZGM4NjI3IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.PE4r1CuBPOxpeUhuXtKgZJ9Az2fOdcHfTwbZkDBaYao)

 (image/png)    


[my_result_2023-11-17_163506_20_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTI4OTcwYzJhZjRmNTIwN2I0IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.0yKlXI2guZmsbQUbiM-O85MuQkar6oyqyt37T0YhYMU)

 (image/png)    


[my_result_2023-11-17_171144_03_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTJhMWFkOWEzMzExZGM4NjI4IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.dEkAKwN2I0yQnNi-ARo8kuwEegHwx8L7nKISKIrS7ck)

 (image/png)    


[my_result_2023-11-17_111018_02_ferture3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTJhMWFkOWEzMzExZGM4NjI5IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.adL5d2N1tsGCpkl0vvQ6Z14DiXqsYJewBRF771Br98Q)

 (image/png)    


[my_result_2023-11-16_184101_02_master.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTI4OTcwYzJhZjRmNTIwN2I3IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.4p5H-iYbarftk9Cmaz2kckxPsMbIBRUrQR1EWjxlQzU)

 (image/png)    


[my_result_2023-11-16_203713_02_ferture2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTJhMWFkOWEzMzExZGM4NjJiIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.-AqkkdKlYtNqtqEaxyOOHtPMQZylnYw1hqkHX0nR7zs)

 (image/png)    


[my_result_2023-11-16_162842_02_ferture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTI4OTcwYzJhZjRmNTIwN2I5IiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.4fF5rqE2agLKxcp8n4wNtwoYUBkNQP6TrSRks6NSUi8)

 (image/png)    


[TPCC模型下的undo机制优化-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTJhMWFkOWEzMzExZGM4NjJlIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.GO30QR1ZeKOZ7ojLTLUcR-761bqk0lbBPw_SpSaa7u0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTJhMWFkOWEzMzExZGM4NjJmIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.bmIVmTjbsp9RAmOm1kAjft6GZcpRGm4gDdEM3Jv-FAA)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTI4OTcwYzJhZjRmNTIwN2JhIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.u22ml4caJUtiVEdqKqLUGS_M6_P4rqDlcrLhUNwDYR0)

 (application/msword)    


[lsc表支持本地索引.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTI4OTcwYzJhZjRmNTIwN2JjIiwicmVmX2lkIjoiNjczOTZiZTA3MjgyMDZlZmI5MmYwYWVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTgwLCJleHAiOjE3ODIzODM5ODB9.7wtQWxIOxTxE9v1xxN8CSR0EK8KslawHD0rTNfK71p0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    

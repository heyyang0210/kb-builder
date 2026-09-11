Created by 李世铭, last modified on 十一月 29, 2023

# 1. 概述

YashanDB支持通过yasboot工具滚动升级已经部署的数据库，在数据库不停机的情况下，将数据库升级到新版本。

# 2. 需求分析

SR：    [YDBRD-22193](https://jira.yasdb.com/browse/YDBRD-22193?src=confmacro)    -  【OM】yasboot支持单机滚动升级  完成

设计文档：    [滚动升级设计文档](127652425.html)  

概要设计：    [YDBRD-18912 测试概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133587461)  

## 2.1 功能点分析

- yasboot cluster upgrade 新增参数：
- yasboot rollback  新增参数：


|序号|长参|短参|说明|是否必填|
|:---|:---|:---|:---|:---|
|1|--rolling|  
|用于升级集群时选择是否滚动升级|否|
|2|--keep-primary|  
|用于选择滚动升级后是否切回原来的主节点|否|


|序号|长参|短参|说明|是否必填|
|:---|:---|:---|:---|:---|
|1|--rolling|  
|用于滚动升级回滚，不能和force参数一起使用|否|


滚动升级流程

1.校验版本，是否快捷升级（小版本变动），否就报错退出； --小版本有不兼容修改是db的问题，后续报错    
  2.关闭所有节点HA（先备后主），记录HA    
  3.检查节点数量，大于2不修改保护模式，2保护模式修改成最大可用，1报错退出    
  4.关闭备库，替换二进制，拉起备机  22.2.5.3/bin/yasdb open  -D  data/se/db-1-1    
  5.等待备机同步（select * from v$replication_status;  apply_lag < 1s,  connection,  status）    
  6.继续下一个备节点，重复4-5    
  7.备机升级完成，进行switchover；对一个备机执行ALTER DATABASE SWITCHOVER;执行后查看同步是否正常。    
  8.旧主重复4-5    
  9.恢复升级前HA设置和保护模式。    
  10. 根据--keep-primary参数决定是否切回原来的主节点

## 2.2 应用场景

可以用于在使用jdbc开启透明故障转移（taf）时升级，用户使用jdbc连接数据库执行的业务在升级期间不会受到影响，可以正常执行且结果符合预期

## 2.3 约束

- 只允许单机数据库使用。
- 如果只有一个节点，则不适用于滚动升级，会报错退出。
- 两个节点的时候，滚动升级会在最大可用保护模式下进行；多于两个节点，则不会修改保护模式。
- 滚动升级的回滚作用有限，主要是为了应对升级流程中断的情况。当升级中遇到了网络故障，可以回滚到之前的状态。但是假如在升级过程中，db出现主备切换出现问题、无法同步等情况，可能导致升级和回滚都无法成功，这种情况需要人工排查问题。


# 3. 详细测试设计

## 3.1 测试设计方法

节点验证–边界值；等价类

部署验证，业务校验，HA验证，交互验证-场景组合

配置验证-等价类

流程验证–路径覆盖

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


  


|  
|类型|二级分类|测试点|细分测试点|预期|备注|
|---|---|---|---|---|---|---|
|1|冒烟用例|  
|  
|可正常滚动升级|升级成功，且一直有处于open状态的主节点|  
|
|2|  
|  
|  
|om故障时可以滚动回退|升级失败并可以回退|  
|
|3|参数测试|  
|--keep-primary|加参数--keep-primary后执行滚动升级|升级后可以切换回原主节点|  
|
|4|  
|  
|  
|不加--rolling时，加--keep-primary参数升级|不会影响正常的离线升级流程|  
|
|5|  
|  
|--rolling|回退时与--force一起使用|报错拦截|  
|
|6|升级流程|升级前|获取安装包|目标版本小于旧版本|拦截报错|  
|
|7|  
|  
|  
|目标版本对于旧版本是新的大版本|拦截报错|  
|
|8|  
|  
|  
|使用与当前环境不同的架构的包|拦截报错|  
|
|9|  
|  
|确认新版本目录|空间不足|拦截报错|内存/硬盘空间不足|
|10|  
|  
|  
|权限不够|拦截报错|  
|
|11|  
|  
|ssh服务|关闭ssh服务|拦截报错|  
|
|12|  
|  
|实例状态|open|升级成功|  
|
|13|  
|  
|  
|nomount/mount/need repair|拦截报错|  
|
|14|  
|  
|monit进程|托管到ycm不kill monit|拦截报错/可以恢复到升级前的状态|  
|
|15|  
|  
|  
|om拉起monit|拦截报错|  
|
|16|  
|  
|hosts.toml|修改host.toml的用户名密码/端口为错误值|拦截报错|  
|
|17|  
|升级中|升级OM|yasagent或yasom故障|升级失败并可以回退后再升级|  
|
|18|  
|  
|升级DB|yasagent或yasom故障|升级失败并可以回退后再升级|  
|
|19|  
|  
|  
|yasdb故障|可以手动恢复|  
|
|20|  
|  
|  
|轮询集群状态|一直有处于open状态的主节点|  
|
|21|  
|升级后|  
|检查集群状态|open且可以正常执行业务|  
|
|22|节点验证|节点数量|  
|单节点|拦截报错|  
|
|23|  
|  
|  
|一主一备|升级成功|  
|
|24|  
|  
|  
|一主二备|升级成功|  
|
|25|  
|  
|  
|一主三十二备|升级成功|  
|
|26|部署验证|部署模式|  
|单机|升级成功|  
|
|27|  
|  
|  
|集群|拦截报错|  
|
|28|  
|  
|  
|分布式|拦截报错|  
|
|29|  
|部署路径|  
|修改配置文件中的部署路径，不带版本号|升级成功|  
|
|30|配置验证|生效范围|  
|both|升级后保持一致|  
|
|31|  
|  
|  
|file|升级后保持一致|  
|
|32|业务验证|  
|  
|升级前执行业务，升级期间无业务|升级前后数据一致|  
|
|33|  
|  
|  
|升级期间执行DDL业务|升级期间业务不会报错，元数据升级后符合预期|DDL：create/alter/drop/trunca,对象：table/index/ac/dblink/view/materialized view/sequence/synonym/partition/procedure/ function/package/job/triger|
|34|  
|  
|  
|升级期间执行DML业务|业务不会报错，期间数据一直一致，不会出现账不平|DML:insert/update/delete|
|35|  
|  
|  
|长事务时升级|业务不会报错，升级后数据符合预期|长查询，长时间的DDL|
|36|  
|  
|  
|修改sys用户密码后升级|升级成功|  
|
|37|HA验证|主备同步|  
|升级期间，有增量业务|升级后备机能自动同步|  
|
|38|  
|保护模式|  
|最大保护/最大性能/最大可用|升级成功，且升级后保护模式保持不变|  
|
|39|交互验证|扩缩容|  
|升级时执行扩缩容任务|拦截报错|  
|
|40|  
|  
|  
|扩缩容后升级|升级成功|使用部署时的hosts.toml|
|41|  
|导数|  
|升级时使用imp工具导入数据|导数不报错，升级后数据查询符合预期|  
|
|42|  
|  
|  
|升级时load data语句导数|导数不报错，升级后数据查询符合预期|  
|
|43|  
|备份恢复|  
|升级时使用om工具备份|拦截报错/可以备份，且升级成功|  
|
|44|  
|  
|  
|升级时使用sql语句备份|备份成功，且升级成功|  
|
|45|  
|  
|  
|升级时使用om工具恢复|拦截报错|  
|
|46|  
|  
|  
|升级时尝试使用sql语句恢复|升级失败，且需要手动恢复|  
|
|47|  
|启动数据库|  
|升级时尝试使用om工具启动数据库|拦截报错|cluster/group/node|
|48|可靠性|  
|  
|正在升级的节点故障|故障可回退，回退前后业务无损|  
|
|49|  
|  
|  
|升级备节点时主节点故障|故障可回退，回退前后业务无损|  
|
|50|  
|  
|  
|升级主节点时已升级的备节点故障|故障可回退，回退前后业务无损|  
|
|51|并发|  
|  
|较大流量下升级|升级成功|100并发|
|52|性能|  
|  
|无业务时升级|计算耗时|  
|
|53|  
|  
|  
|升级时跑tpch|计算耗时|与不升级时跑tpch耗时对比|


# 4. 测试用例

详见附件

# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


辅助测试工具：jmeter

# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：11/17

## Attachments:

[OM支持单机小版本滚动升级.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWI4OTcwYzJhZjRmNTIwNjNkIiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.iM4-A6lBN6kvKG2jKVli0A-wDqmjWCkRV0pWkkuLrpA)

 (application/x-xmind)    


[OM支持单机小版本滚动升级.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWJhMWFkOWEzMzExZGM4NGI0IiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.7pGGxZoPRg_pDWBSfsj9BC0nAZrL4mKRlc3PWLGmZzE)

 (application/x-xmind)    


[YDBRD-18912 yasboot支持单机小版本滚动升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWI4OTcwYzJhZjRmNTIwNjNlIiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.sKWzR0ZiuGJUJFg0NCZsQJsvVTmhcVAEI0G5Ph-C9HA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-18912 yasboot支持单机小版本滚动升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWJhMWFkOWEzMzExZGM4NGI1IiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.BAPvhB7Yv3Ur6CGdBZJScg4jSrr8B1KcyAcVSrLzsOY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-18912 yasboot支持单机小版本滚动升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWI4OTcwYzJhZjRmNTIwNjNmIiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.vBG1ym-cp8YHEcl9ChYXlZehV-oT6LTsApcTRgjcanA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-18912 yasboot支持单机小版本滚动升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWI4OTcwYzJhZjRmNTIwNjQwIiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.-EVUoqpBxkthl22HShdu22oFXmO507S_ly_5NDP3l8I)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-18912 yasboot支持单机小版本滚动升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWM4OTcwYzJhZjRmNTIwNjQyIiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.BK1fPkpN7v_EdEK5tlrRzdmXvDJYAxWEho1XxGoQdQE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-18912 yasboot支持单机小版本滚动升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWNhMWFkOWEzMzExZGM4NGI3IiwicmVmX2lkIjoiNjczOTZiYWI3MjgyMDZlZmI5MmYwOGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTY5LCJleHAiOjE3ODIzODI1Njl9.DohB3yAP9xc6h8X86VndZ_jWCvnU9G0QssQbItUcfJ0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计评审会议纪要：,参与人：李世铭、刘美秀、刘顺鹏,1.升级过程中yasdb出现故障可能不能通过yasboot命令回滚，需要手动恢复,2.空间不足的测试要包含内存和硬盘空间不足的情况,Posted by lishiming at 十二月 13, 2023 17:59|
|---|

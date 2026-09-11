Created by 吕雷奇, last modified by  杨锡昌 on 一月 25, 2024

## 1.   **概述**

本文描述  YFS 共享内存优化的测试设计

## 2.   **需求分析**

本需求的开发设计：    [YFS 共享内存优化 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135625814)  

特性sr连接：    [YDBRD-21455](https://jira.yasdb.com/browse/YDBRD-21455?src=confmacro)    -  YFS share memory内存优化  完成

本需求是在YFS的DFX能力的增强，主要简化YFS的配置，原有的配置项  SHM_POOL_SIZE、SYS_AREA_SIZE，本需求调整为上限值，相关内存配置为实时分配，不再预占  。

  


**支持功能：**

- YFS 异常退出时，无需手动清理共享内存。
- YFS 运行时共享内存占用量降低。
- 通过 yfscmd 查看 YFS shm 使用情况。
- 提供在线修改  SHM_POOL_SIZE、SYS_AREA_SIZE两个参数能力
- 通过运维工具查看


**功能限制：**

- 系统内存耗尽，或达到配置上限，报无法分配内存。
- 修改  SHM_POOL_SIZE、SYS_AREA_SIZE配置参数时约束如下：
    - 只能增大，不能缩小。
    - 更新参数值不小于默认值。
    - 不持久化 --重启后会恢复配置文件中的配置，不恢复在线修改结果
    - 先改备后改主。 – 之后去掉约束
    - SHM_POOL_SIZE,SYS_AREA_SIZE上下边界？ – unit 64最大值


# **3. 详细测试方法**

3.1测试设计方法

业务场景通过场景法，参数校验通过边界值法测试；

  


3.2详细测试设计

参数校验：

|序号|场景|预期|备注|进展|
|---|---|---|---|---|
|1|部署2节点集群环境，yasfs.ini 在线修改  SHM_POOL_SIZE参数为256M，1G，10G|可以设置成功，可以通过  show status   查看SHM_POOL_SIZE对应值|  
|完成|
|2|部署2节点集群环境，yasfs.ini 在线修改  SHM_POOL_SIZE参数为下边界|可以设置成功，可以通过  show status   查看SHM_POOL_SIZE对应值|  
|完成|
|3|部署2节点集群环境，yasfs.ini 在线修改  SHM_POOL_SIZE参数为上边界或超大值？|可以正常设置成功，可以通过  show status   查看SHM_POOL_SIZE对应值|  
|完成|
|4|部署2节点集群环境，yasfs.ini 在线修改  SHM_POOL_SIZE参数为负数、小数|报错内容正常|  
|完成|
|5|部署2节点集群环境，yasfs.ini 在线修改  SHM_POOL_SIZE参数为字符串，特殊字符、中文字符等|报错内容正常|  
|完成|
|6|部署2节点集群环境，yasfs.ini 在线修改  SYS_AREA_SIZE  参数为256M，1G，10G|可以设置成功，可以通过  show status   查看SYS_AREA_SIZE对应值|  
|完成|
|7|部署2节点集群环境，yasfs.ini 在线修改  SYS_AREA_SIZE  参数为下边界|可以设置成功，可以通过  show status   查看SYS_AREA_SIZE对应值|  
|完成|
|8|部署2节点集群环境，yasfs.ini 在线修改  SYS_AREA_SIZE  参数为上边界或超大值？|可以正常设置成功，可以通过  show status   查看SYS_AREA_SIZE对应值|  
|完成|
|9|部署2节点集群环境，yasfs.ini 在线修改  SYS_AREA_SIZE  参数为负数、小数|报错内容正常|  
|完成|
|10|部署2节点集群环境，yasfs.ini 在线修改  SYS_AREA_SIZE  参数为字符串，特殊字符、中文字符等|报错内容正常|  
|完成|
|11|部署2节点集群环境，修改yasfs.ini文件中  SHM_POOL_SIZE参数为较小值，重启ycs实例|为0时会自动提升到64M|  
|完成|
|12|部署2节点集群环境，修改yasfs.ini文件中  SHM_POOL_SIZE参数为极大值，重启ycs实例|启动失败，报错内容正常|  
|完成|
|13|部署2节点集群环境，修改yasfs.ini文件中  SHM_POOL_SIZE参数为正常值，重启ycs实例|启动成功|  
|完成|
|14|部署2节点集群环境，修改yasfs.ini文件中  SHM_POOL_SIZE参数为特殊字符，中文字符，字符串等，重启ycs实例|启动失败，报错内容正常|  
|完成|
|15|部署2节点集群环境，修改yasfs.ini文件中  SYS_AREA_SIZE  参数为较小值，重启ycs实例|为0时会自动提升到32M|  
|完成|
|16|部署2节点集群环境，修改yasfs.ini文件中  SYS_AREA_SIZE  参数为极大值，重启ycs实例|启动失败，报错内容正常|  
|完成|
|17|部署2节点集群环境，修改yasfs.ini文件中  SYS_AREA_SIZE  参数为正常值，重启ycs实例|启动成功|  
|完成|
|18|部署2节点集群环境，修改yasfs.ini文件中  SYS_AREA_SIZE  参数为特殊字符，中文字符，字符串等，重启ycs实例|启动失败，报错内容正常|  
|完成|


业务场景，主备节点分别下发：

|序号|场景|子项|预期|备注|进展|
|---|---|---|---|---|---|
|1|使用默认值部署环境|部署2节点集群环境，yasfs.ini不配置  SHM_POOL_SIZE、SYS_AREA_SIZE，使用默认值|可以正常部署环境，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用大小，  db下发和yfscmd正常下发业务|  
|完成|
|2|在线修改参数生效|部署2节点集群环境，在线修改  SHM_POOL_SIZE参数大于当前使用值，并触发创建文件操作|可以正常设置成功，通过  show status   查看SHM_POOL_SIZE最大值为设置值，使用共享内存值会变大|  
|完成|
|3|  
|部署2节点集群环境，在线修改  SHM_POOL_SIZE参数小于当前使用值|报错内容正常|  
|完成|
|4|  
|部署2节点集群环境，在线修改  SHM_POOL_SIZE参数小于 当前默认值|报错内容正常|  
|完成|
|5|  
|部署2节点集群环境，在线修改  SYS_AREA_SIZE  参数大于当前使用值，并触发创建文件操作|可以正常设置成功，通过  show status   查看SYS_AREA_SIZE最大值为设置值，使用共享内存值会变大|  
|完成|
|6|  
|部署2节点集群环境，在线修改  SYS_AREA_SIZE  参数小于当前使用值|报错内容正常|  
|完成|
|7|  
|部署2节点集群环境，在线修改  SYS_AREA_SIZE  参数小于当前默认值|报错内容正常|  
|完成|
|8|多dg多副本下初始内存消耗|部署2节点集群环境，yasfs.ini不配置  SHM_POOL_SIZE、SYS_AREA_SIZE，使用默认值，创建单DG单副本|可以正常部署环境，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用大小，  db下发和yfscmd正常下发业务|  
|完成|
|9|  
|部署2节点集群环境，yasfs.ini不配置  SHM_POOL_SIZE、SYS_AREA_SIZE，使用默认值，创建单DG normal副本|可以正常部署环境，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用大小，  db下发和yfscmd正常下发业务|  
|  
|
|10|  
|部署2节点集群环境，yasfs.ini不配置  SHM_POOL_SIZE、SYS_AREA_SIZE，使用默认值，创建单DG high副本|可以正常部署环境，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用大小，  db下发和yfscmd正常下发业务|  
|  
|
|11|  
|部署2节点集群环境，yasfs.ini不配置  SHM_POOL_SIZE、SYS_AREA_SIZE，使用默认值，创建多DG high副本|可以正常部署环境，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用大小，  db下发和yfscmd正常下发业务|  
|  
|
|12|  
|部署2节点集群环境，yasfs.ini不配置  SHM_POOL_SIZE、SYS_AREA_SIZE，使用默认值，创建512个 DG high副本|可以正常部署环境，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用大小，  db下发和yfscmd正常下发业务|  
|  
|
|13|重启（kill）yfs进程，内存释放|部署2节点集群环境，配置  SHM_POOL_SIZE、SYS_AREA_SIZE，触发业务使得两个内存值上涨，kill 对应进程实例|通过free -g 可以看到kill 前后内存会释放|  
|完成|
|14|  
|部署2节点集群环境，配置  SHM_POOL_SIZE、SYS_AREA_SIZE，触发业务使得两个内存值上涨，stop 对应进程实例|通过free -g 可以看到stop 前后内存会释放|  
|完成|
|15|  
|部署2节点集群环境，配置  SHM_POOL_SIZE、SYS_AREA_SIZE，触发业务使得两个内存值上涨，kill进程实例后，重启对应进程|可以正常重启，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用值恢复到初始状态|  
|完成|
|16|  
|部署2节点集群环境，配置  SHM_POOL_SIZE、SYS_AREA_SIZE，触发业务使得两个内存值上涨，重启对应进程|可以正常重启，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用值恢复到初始状态|  
|完成|
|17|其他异常场景|当集群环境内存不足时，部署2节点集群环境，配置  SHM_POOL_SIZE、SYS_AREA_SIZE，触发业务使得两个内存值上涨，触发申请不到内存场景|申请不到内存时，业务场景报错，机器内存释放后，业务继续执行不报错|  
|完成|
|18|  
|两实例的参数设置不一致  SHM_POOL_SIZE、SYS_AREA_SIZE时（在线修改，配置yasfs.ini）?|如果备机设置小的实例业务会卡住，主机没有影响|  
|  
|
|19|长稳|部署2节点集群环境，配置  SHM_POOL_SIZE、SYS_AREA_SIZE，触发yfs元数据变更业务|观察是否有内存泄漏|  
|  
|
|20|多DG下并发消耗共享内存|部署2节点集群环境，yasfs.ini不配置  SHM_POOL_SIZE、SYS_AREA_SIZE，使用默认值，创建多DG high副本，并发创建删除文件等操作，消耗共享内存，yfs其他业务正常，没有卡住|  
|  
|  
|
|21|  
|快速消耗共享内存（truncate 文件），show status 会看到  SHM_POOL_SIZE 使用大小会快速变大|  
|  
|  
|
|22|  
|yfsminer 解析 shm.id 文件，重启时候检查|  
|  
|  
|


  


2.DFX关联场景：

|  
|测试项|是否涉及|  
|
|---|---|---|---|
|1|长稳|涉及|  
|
|2|可靠性|涉及|  
|
|3|并发|不涉及|  
|
|4|HA|不涉及|  
|
|5|安全|不涉及|  
|
|6|一致性|不涉及|  
|
|7|压力|不涉及|  
|
|8|可维护性|不涉及|  
|
|9|性能|涉及|  
|


# **4.**  **详细测试设计**   

1.冒烟用例；

|序号|场景|预期|  
|
|---|---|---|---|
|1|部署2节点集群环境，在线修改  SHM_POOL_SIZE参数为256M，1G，10G|可以设置成功，可以通过  show status   查看SHM_POOL_SIZE对应值|  
|
|2|部署2节点集群环境，yasfs.ini 在线修改  SYS_AREA_SIZE  参数为256M，1G，10G|可以设置成功，可以通过  show status   查看SYS_AREA_SIZE对应值|  
|
|3|部署2节点集群环境，配置  SHM_POOL_SIZE、SYS_AREA_SIZE，触发业务使得两个内存值上涨，kill进程实例后，重启对应进程|可以正常重启，可以通过  show status   查看SHM_POOL_SIZE、SYS_AREA_SIZE 默认值和使用值恢复到初始状态|  
|


2.用例

# **5.测试框架**

使用ha_regress测试框架

# **6.测试环境**

本地测试环境，1台机器部署4实例；

# **7.工作量评估**

工作量：3人天

计划测试完成时间：

  


  


  


## Attachments:

[image2023-12-11_18-52-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2JhMWFkOWEzMzExZGM4NTU4IiwicmVmX2lkIjoiNjczOTZiY2I3MjgyMDZlZmI5MmYwYTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTE1LCJleHAiOjE3ODIzODM1MTV9.WlEZzTnQaCAC9s-1w0MLKeEroKimGoOGgyKihMjs-RA)

 (image/png)    


[image2023-12-11_18-46-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2JhMWFkOWEzMzExZGM4NTU5IiwicmVmX2lkIjoiNjczOTZiY2I3MjgyMDZlZmI5MmYwYTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTE1LCJleHAiOjE3ODIzODM1MTV9.yx5p8H2IEMY3cZKbQXTq-MW2ogUd2emc4maW5SE9Gy4)

 (image/png)    


[split_table_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2JhMWFkOWEzMzExZGM4NTVhIiwicmVmX2lkIjoiNjczOTZiY2I3MjgyMDZlZmI5MmYwYTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTE1LCJleHAiOjE3ODIzODM1MTV9.74wfcwQ8m5_JW5GMfW6tvBSFrpYT_pn8GUfA6l2FajE)

 (image/gif)    


[集群支持split分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2I4OTcwYzJhZjRmNTIwNmU2IiwicmVmX2lkIjoiNjczOTZiY2I3MjgyMDZlZmI5MmYwYTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTE1LCJleHAiOjE3ODIzODM1MTV9.q4L1Pzi3mc7f-RCzmi85f8Ok6CNNVl0kSUYRdQDfH_U)

 (application/x-xmind)    


[image2023-11-7_9-36-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2JhMWFkOWEzMzExZGM4NTViIiwicmVmX2lkIjoiNjczOTZiY2I3MjgyMDZlZmI5MmYwYTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTE1LCJleHAiOjE3ODIzODM1MTV9.HJUHIiwOTGMzFldWra6l_cVMt9fcA9CV3M4TEpi1juo)

 (image/png)    

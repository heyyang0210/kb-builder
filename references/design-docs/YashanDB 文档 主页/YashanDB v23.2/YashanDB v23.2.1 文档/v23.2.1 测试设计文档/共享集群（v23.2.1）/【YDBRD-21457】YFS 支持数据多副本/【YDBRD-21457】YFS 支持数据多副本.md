Created by 吕雷奇, last modified by  张彩虹 on 一月 24, 2024

## 1.   **概述**

本文描述  YFS 支持数据多副本特性的测试设计，该特性是对yfs功能的DFX能力增强，对标ASM简化了一些流程，只将数据的完整性校验放在yfs侧进行，数据的有效性校验依然放在db层进行。

## 2.   **需求分析**

本需求的开发设计：    [YFS 支持数据多副本 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133567129)  

特性sr连接：    [YDBRD-21457](https://jira.yasdb.com/browse/YDBRD-21457?src=confmacro)    -  YFS 支持数据多副本  完成

本需求是在YFS的DFX能力的增强，在数据多副本（多failgroup）的情况下，有单个副本或者多个副本损坏，保证至少一个副本可用的前提下依然可以正常访问数据文件。

基于性能和复杂度考虑，当前实现方案的是当一个副本内的某个AU数据损坏，直接尝试进行后续副本完整性校验，也就是只能支持同一个副本内的数据完整读取，不支持跨副本拼接的数据（支持左边，不支持右边）。

![](https://pingcode.yasdb.com/atlas/files/public/67396bcc8970c2af4f5206ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCZ0FBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFRQUFBQUFDQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxMzYsImV4cCI6MTc4MjMwNzkzNn0.7Zd_L_gNsRZFDUy5UBnNWOoAOPdvPW8C5SQ1qznj8jo)

![](https://pingcode.yasdb.com/atlas/files/public/67396bcca1ad9a3311dc855e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCZ0FBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFRQUFBQUFDQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxMzYsImV4cCI6MTc4MjMwNzkzNn0.7Zd_L_gNsRZFDUy5UBnNWOoAOPdvPW8C5SQ1qznj8jo)

**支持功能：**

支持以下文件的多副本

1.redo/归档文件

2.表空间文件

3.ctrl文件

4.备份文件

**功能限制：**

不支持磁盘元数据多副本，即磁盘的前3个AU不支持破坏；

# **3. 详细测试方法**

3.1测试设计方法

通过场景法，使用dd命令实现不同文件的破坏后，数据库依然可用，部分场景下可以恢复破坏的文件；

3.2详细测试设计

|序号|测试责任人|场景|预期|备注|进展|
|---|---|---|---|---|---|
|1|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建表空间|在该表空间执行读写操作正常|  
|完成|
|2|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建表空间|在该表空间执行读写操作正常|  
|完成|
|3|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏一个failgroup上表所在AU上的数据，做查询更新操作|可以正常操作成功,查看破坏的数据恢复正确|需要提供手段，确定破坏的是对应AU上的数据|完成|
|4|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建压缩加密自定义表空间，在该表空间创建表，插入数据，破坏一个failgroup上表所在AU上的数据，做查询更新操作|可以正常操作成功,查看破坏的数据恢复正确|  
|完成|
|5|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，使用默认user表空间创建表，插入数据，破坏一个failgroup上表所在AU上的数据，做查询更新操作|可以正常操作成功,查看破坏的数据恢复正确|  
|完成|
|6|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏一个failgroup上swap表空间的元数据，做换入换出查询|可以正常操作成功|备注：Swap的是中间结果，没法作正确性校验，而且是非持久化数据，不需要好多副本|不支持|
|7|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏一个failgroup上system表空间的元数据，创建新的连接做查询更新数据等操作|可以正常操作成功|  
|完成|
|8|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建私有临时表，插入数据，破坏一个failgroup上temp表空间(本地临时表空间，共享临时表空间)的元数据，继续做查询更新数据等操作|可以正常操作成功|需要补充测试|有用例暂不支持|
|9|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建公共临时表，插入数据，破坏一个failgroup上temp表空间(本地临时表空间，共享临时表空间)的元数据，继续做查询更新数据等操作|可以正常操作成功|  
|有用例暂不支持|
|10|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建普通表，插入数据提交，再做update更新数据不提交，破坏一个failgroup上undo表空间的元数据，kill数据库db后重新拉起，查询对应表|数据查询正常|  
|完成|
|11|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建普通表，插入数据提交，生成快照，破坏一个failgroup上sysaux表空间的元数据，再次创建快照，并查看是否能正常生成awr报告|可以正常操作|  
|完成|
|12|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏任意两个failgroup上表所在AU上的数据，做查询更新操作|可以正常操作成功,查看破坏的数据恢复正确|high冗余度还要覆盖破坏1个failgroup|完成|
|13|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建压缩加密自定义表空间，在该表空间创建表，插入数据，破坏任意两个failgroup上表所在AU上的数据，做查询更新操作可以正常操作成功,查看破坏的数据恢复正确|可以正常操作成功,查看破坏的数据恢复正确|  
|完成|
|14|张彩虹|部署2节点集群环境，创建high冗余度DG环境，使用默认user表空间创建表，插入数据，破坏任意两个failgroup上表所在AU上的数据，做查询更新操作|可以正常操作成功,查看破坏的数据恢复正确|  
|完成|
|15|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏任意两个failgroup上swap表空间的元数据，做换入换出查询可以正常操作成功|可以正常操作成功|备注：Swap的是中间结果，没法作正确性校验，而且是非持久化数据，不需要好多副本|不支持|
|16|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏一个failgroup上system表空间的元数据，创建新的连接做查询更新数据等操作|可以正常操作成功|  
|完成|
|17|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建私有临时表，插入数据，破坏一个failgroup上temp表空间（本地和共享临时表空间）的元数据，继续做查询更新数据等操作|可以正常操作成功|  
|完成|
|18|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建普通表，插入数据提交，再做update更新数据不提交，破坏一个failgroup上undo表空间的元数据，kill数据库db后重新拉起，查询对应表数据查询正常|数据查询正常|  
|自动化未完成|
|19|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建普通表，插入数据提交，生成快照，破坏一个failgroup上sysaux表空间的元数据，再次创建快照，并查看是否能正常生成awr报告可以正常操作|可以正常操作|  
|完成|
|20|张彩虹|部署2节点集群环境，创建多个normal冗余度DG环境，创建自定义压缩加密表空间在不同的dg上，插入数据，并创建分区local索引，破坏每个DG中的一个failgroup上的分区数据，执行查询和update更新操作，并查看索引状态|执行有正确返回，索引状态正常|  
|  
|
|21|张彩虹|部署2节点集群环境，创建多个high冗余度DG环境，创建自定义压缩加密表空间在不同的dg上，插入数据，并创建分区local索引，破坏每个DG中的任意一个（或两个）failgroup上的分区数据，执行查询和update更新操作，并查看索引状态执行有正确返回，索引状态正常|执行有正确返回，索引状态正常|  
|  
|
|22|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，破环一个failgrop上ctrl文件，进行数据库的重启|可以正常启动|  
|完成|
|23|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，创建表，做dml操作，破环一个failgrop上redo文件，进行kill数据库，然后重启数据库实例，做表的dml操作|可以正常启动，dml操作正常|  
|完成|
|24|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，使用yasrman备份数据（sql），破环一个failgrop上备份文件，进行数据库的恢复|可以正常恢复|暂时不支持|  
|
|25|张彩虹|部署2节点集群环境，创建normal冗余度DG环境，使用sql备份数据，破环一个failgrop上备份文件，进行数据库的恢复|可以正常恢复|暂时不支持|  
|
|26|张彩虹|部署2节点集群环境，创建high冗余度DG环境，破环任意一个（或两个）failgrop上ctrl文件，进行数据库的重启可以正常启动|可以正常启动|  
|完成|
|27|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建表，做dml操作，破环任意一个（或两个）failgrop上redo文件，进行kill数据库，然后重启数据库实例，做表的dml操作|可以正常启动，dml操作正常|  
|完成|
|28|张彩虹|部署2节点集群环境，创建high冗余度DG环境，使用yasrman备份数据，破环任意一个（或两个）failgrop上备份文件，进行数据库的恢复|可以正常恢复|暂时不支持|  
|
|29|张彩虹|部署2节点集群环境，创建high冗余度DG环境，使用sql备份数据，破环任意一个（或两个）failgrop上备份文件，进行数据库的恢复|可以正常恢复|暂时不支持|  
|
|30|张彩虹|部署2节点集群环境，创建high冗余度DG环境，创建表，做dml操作，破坏不同副本上不同位置AU的数据，保持一个副本可用，做dml操作|dml操作正常|  
|  
|
|31|张彩虹|多副本下性能基线场景|  
|对写的场景可能有影响|完成|
|32|张彩虹|破坏数据文件后查询数据正常继续破坏文件|集群可正常使用，可正常重启|  
|  
|


  


2.DFX关联场景：

|  
|测试项|是否涉及|  
|
|---|---|---|---|
|1|长稳|不涉及|  
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
|---|---|---|
|1|部署2节点集群环境，创建normal冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏一个failgroup上表所在AU上的数据，做查询更新操作|可以正常操作成功,查看破坏的数据恢复正确|
|2|部署2节点集群环境，创建normal冗余度DG环境，破环一个failgrop上ctrl文件，进行数据库的重启|可以正常启动|
|3|部署2节点集群环境，创建high冗余度DG环境，创建普通自定义表空间，在该表空间创建表，插入数据，破坏任意两个failgroup上表所在AU上的数据，做查询更新操作|可以正常操作成功,查看破坏的数据恢复正确|
|4|部署2节点集群环境，创建high冗余度DG环境，破环任意一个（或两个）failgrop上ctrl文件，进行数据库的重启可以正常启动|可以正常启动|


2.用例

# **5.测试框架**

使用ha_regress测试框架

# **6.测试环境**

本地测试环境，1台机器部署4实例；

# **7.工作量评估**

工作量：14人天

计划测试完成时间：

  


  


  


## Attachments:

[split_table_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2M4OTcwYzJhZjRmNTIwNmU3IiwicmVmX2lkIjoiNjczOTZiY2M3MjgyMDZlZmI5MmYwYTU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTM2LCJleHAiOjE3ODIzODM1MzZ9.Tbc3YE-9TRMXDOQukkevQyHbCgEhdG4RvBUgjkTBxOA)

 (image/gif)    


[集群支持split分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2M4OTcwYzJhZjRmNTIwNmU4IiwicmVmX2lkIjoiNjczOTZiY2M3MjgyMDZlZmI5MmYwYTU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTM2LCJleHAiOjE3ODIzODM1MzZ9.-7dJD7W_Oud8fCZGKHOD2e0oAOi63mXhykewqtgG2Ks)

 (application/x-xmind)    


[image2023-11-7_9-36-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2NhMWFkOWEzMzExZGM4NTVjIiwicmVmX2lkIjoiNjczOTZiY2M3MjgyMDZlZmI5MmYwYTU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTM2LCJleHAiOjE3ODIzODM1MzZ9.2Bd7Aup0_g7ztu_4S7SXCh0dNxMcD46tM9NPMJjUb18)

 (image/png)    

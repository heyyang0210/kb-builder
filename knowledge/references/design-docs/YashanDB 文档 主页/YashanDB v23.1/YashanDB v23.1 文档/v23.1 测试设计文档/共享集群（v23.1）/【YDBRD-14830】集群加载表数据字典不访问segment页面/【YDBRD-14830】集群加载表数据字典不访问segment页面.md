Created by 张彩虹, last modified on 十一月 13, 2023

**SR链接：**    [YDBRD-14830](https://jira.yasdb.com/browse/YDBRD-14830?src=confmacro)    **-**  **集群加载表数据字典不访问segment页面**  **完成**

**开发设计文档链接：**    [系统表seg$方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119543591)  

# **1.概述**

本设计文档，为系统表seg$的  测试设计

# **2.需求分析**

增加seg$表之后，数据库加载数据字典时，不需要从磁盘读segment block，而是通过查询seg$获取segment相关信息。

# **3.规格**

1、部署形态：单机&集群

2、集群节点数：三节点

3、集群部署模式：单主机磁阵+多主机磁阵

# **4.约束限制**

真实存储数据的物理表类型，才会在seg$中有相应条目

逻辑表类型，在seg$中没有相应记录

# **5.动态视图/配置参数**

|字段名|含义|字段类型|是否为空|
|---|---|---|---|
|OBJ#|对象object id|BINARY_BIGINT|否|
|ENTRY|对象的file no+ block no|BINARY_INTEGER|否|
|DATAOBJ#|对象的dataoid|BINARY_BIGINT|否|
|ECN#|extent change number|BINARY_INTEGER|否|
|TYPE#|segment类型。0代表TABLE, 1 代表索引， 2 代表LOB|BINARY_INTEGER|否|
|TS#|表空间no|BINARY_INTEGER|否|
|USER#|owner的no|BINARY_INTEGER|否|
|VERSION#|segment版本。0代表BASE, 1 代表AUTO|BINARY_INTEGER|否|
|INIEXTS|初始extent的block数量|BINARY_BIGINT|否|
|MAXSIZE|对象可达到的最大block个数|BINARY_BIGINT|否|
|RESERVED_1|预留字段1|BINARY_BIGINT|是|
|RESERVED_2|预留字段2|BINARY_INTEGER|是|


# **6.测试设计方法**

本次设计主要采用  场景法、等价类划分法等测试方法进行设计

1、测试对象包含所有会影响系统表数据的数据库对象（索引、heap表、lsc表、tac表、lob表（CLOB、blob）、分区表、AC等）

2、系统表数据验证：

     1）进行create、drop、truncate、shrink操作可影响系统表中数据

     2）集群各个实例进行并发操作，观测系统表中数据正确性

 3、升级场景：因为需求转测时只支持单机升级，故只测试单机升级后系统表数据变化

4、高级包测试：SEGMENT_ECN(返回segment 的ecn)

入参：表空间# 、 file number、block number、dataobj#

根据等价类划分法和边界值法对高级包函数各个入参进行验证

详细测试点参考"详细测试设计"

# **7.详细测试设计**

[系统表seg$.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzM4OTcwYzJhZjRmNTFmYTY5IiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.ojkHg-_2RrG1-a4VKkbD7UlUM4Uz2WsrFuYPgYdHaDw)

# **8.测试用例**

[YDBRD-14830集群加载表数据不访问segment_文本测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzNhMWFkOWEzMzExZGM3OGRlIiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.yjDjSIhOPXM4V_XdMXMXwaVIU_imQFRkXUnMTqsVB9o)

[system_table_seg.zip](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzM4OTcwYzJhZjRmNTFmYTZhIiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.zxmK-pXNgn--W8RuosqDFYFSqGI-W_KWeVHhMA6HQv8)

# **9.测试框架/测试用例自动化**

Guider

# **10.测试环境说明**

  


# **11.测试版本**

## Attachments:

[alter_table.zip](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzNhMWFkOWEzMzExZGM3OGRmIiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.9T8ih8kWnTrVlEacu5vi6LtP8o_rzG6xL3BPFV43kso)

 (application/zip)    


[系统表seg$.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzM4OTcwYzJhZjRmNTFmYTY5IiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.ojkHg-_2RrG1-a4VKkbD7UlUM4Uz2WsrFuYPgYdHaDw)

 (application/x-xmind)    


[YDBRD-14830集群加载表数据不访问segment_文本测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzNhMWFkOWEzMzExZGM3OGUwIiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.brTJB9zaYDvMen1pTWo_-n0SNeA4JFFQsEyMa4agdRU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[system_table_seg.zip](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzM4OTcwYzJhZjRmNTFmYTZhIiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.zxmK-pXNgn--W8RuosqDFYFSqGI-W_KWeVHhMA6HQv8)

 (application/zip)    


[YDBRD-14830集群加载表数据不访问segment_文本测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzNhMWFkOWEzMzExZGM3OGRlIiwicmVmX2lkIjoiNjczOTY5YzM3MjgyMDZlZmI5MmVmNzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4ODgwLCJleHAiOjE3ODIyOTUyODB9.yjDjSIhOPXM4V_XdMXMXwaVIU_imQFRkXUnMTqsVB9o)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    

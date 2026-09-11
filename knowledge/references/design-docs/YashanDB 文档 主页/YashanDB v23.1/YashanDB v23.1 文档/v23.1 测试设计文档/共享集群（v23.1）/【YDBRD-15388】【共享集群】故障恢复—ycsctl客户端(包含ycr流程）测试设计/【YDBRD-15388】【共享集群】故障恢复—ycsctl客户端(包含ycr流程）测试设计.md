Created by 徐凡博, last modified by  张茜 on 二月 28, 2024

**SR链接：**    [YDBRD-15388](https://jira.yasdb.com/browse/YDBRD-15388?src=confmacro)    **-**  **【共享集群】故障恢复——ycsctl客户端(包含ycr流程）**  **完成**

**开发设计文档：**    [共享集群故障恢复——ycsctl工具&ycr梳理](122062907.html)  

# **1、概述**

本SR主要涉及共享集群软件中集群管理模块YASCS系统对于ycsctl工具&ycr梳理这块的异常梳理与恢复

异常： 1.环境异常 2.配置文件异常 3.键入命令异常 4.YCR命令异常

根据上述异常而触发YASCS软件整体的异常流程处理。

参考文献：[YASDB故障模式库-共享集群]       [https://conf.yasdb.com/pages/viewpage.action?pageId=104221906](https://conf.yasdb.com/pages/viewpage.action?pageId=104221906)  

# **2、需求分析**

**1、ycsctl工具流程异常：针对ycsctl所有命令**

**     **  分client端和server端。

     故障产生原因：

1）对基础环境的依赖：线程资源不足、网络通信失败、数据包异常等。

2）配置文件的依赖：文件不存在、权限不对、内容不对等。

**2、ycr异常：YCR命令独有的异常**

     故障产生的原因：

       1）create cluster：内存分配失败、  盘加锁及初始化失败、YFS启动失败  等；

       2）add node: 内存分配、盘加锁失败、添加节点时读写失败；

       3）add yasdbinstance：内存分配失败、  盘加锁、添加实例时读写失败  等；

       4）show config：内存分配失败、读YCR盘失败等。

**故障注入手段：**  开发提供的故障点注入故障。

# **3、格范围**

1）部署形态：集群

2）节点数量：两节点

3）部署模式：磁阵环境

# **4、约束限制**

仅针对YCS实例运行中的对于ycsctl工具&ycr这块的异常处理流程。

# **5、动态视图/配置参数**

不涉及

# **6、测试设计方法**

场景法、错误推测法。

1、ycsctl工具流程异常：

     目前ycsctl支持的命令有16种，故障主要发生在ycsctl客户端，这部分需根据场景组合具体命令与故障点进行测试，覆盖全面。

2、ycr命令流程异常：

     这部分主要根据具体故障点实施故障注入与触发即可。

# **7、详细测试设计**

# **8、测试用例**

[【YDBRD-15388】【共享集群】故障恢复—ycsctl客户端(包含ycr流程）测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2Q4OTcwYzJhZjRmNTFmYTk4IiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.2aOnX9yseh3HoNsU8O-BCIRtJmOWgfCYstNCCh61tjs)

[YDBRD-15388  ycsctl工具_测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2RhMWFkOWEzMzExZGM3OTExIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.repm3DR6S1uZAXkxm_8YK92fEmsD_rRh_3p4oBr3vKY)

自动化：yasft/ha/ha_cluster/testcase/fault_test/ycs_fault/Ycsctl_Fault

# **9、测试框架/测试用例自动化**

# **10、测试环境说明**

1、两节点磁阵

# **11、测试版本**

## Attachments:

[【YDBRD-15388】【共享集群】故障恢复—ycsctl客户端(包含ycr流程）测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2RhMWFkOWEzMzExZGM3OTBlIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.db-ZkisVcMJcHYdF5oNdgzrIbS-P4KsL__sXBvxcuD0)

 (application/x-xmind)    


[【YDBRD-15388】【共享集群】故障恢复—ycsctl客户端(包含ycr流程）测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2RhMWFkOWEzMzExZGM3OTBmIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.ICe0ektJl4SbOYSWV6l1sgo38ZDUKM97HeK3kCKeUTI)

 (application/x-xmind)    


[【YDBRD-15388】【共享集群】故障恢复—ycsctl客户端(包含ycr流程）测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2RhMWFkOWEzMzExZGM3OTEwIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.Df2Q8eWxrsKdL2Tb1C75rSZ_ZA5cJIY6VbzRqW9aIks)

 (application/x-xmind)    


[【YDBRD-15388】【共享集群】故障恢复—ycsctl客户端(包含ycr流程）测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2Q4OTcwYzJhZjRmNTFmYTk4IiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.2aOnX9yseh3HoNsU8O-BCIRtJmOWgfCYstNCCh61tjs)

 (application/x-xmind)    


[YDBRD-15388  ycsctl工具_测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2Q4OTcwYzJhZjRmNTFmYTlhIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.qMwoIDjTXC0KxyNbqFCaRrzrRLxt33PFtSQTgnaw6-Y)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-15388  ycsctl工具_测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2RhMWFkOWEzMzExZGM3OTExIiwicmVmX2lkIjoiNjczOTY5Y2M3MjgyMDZlZmI5MmVmN2E2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQzLCJleHAiOjE3ODIyOTU0NDN9.repm3DR6S1uZAXkxm_8YK92fEmsD_rRh_3p4oBr3vKY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    

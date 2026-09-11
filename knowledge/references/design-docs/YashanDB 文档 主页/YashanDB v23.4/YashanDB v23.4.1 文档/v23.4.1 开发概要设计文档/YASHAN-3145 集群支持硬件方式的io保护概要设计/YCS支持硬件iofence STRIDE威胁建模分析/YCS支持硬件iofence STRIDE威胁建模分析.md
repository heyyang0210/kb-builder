# **1. 项目概述**

**功能描述：**    
  YCS硬件iofence利用SCSI协议中的预留功能，控制共享存储中的数据盘的访问权限，取消故障节点的访问权限，防止集群脑裂写坏磁盘。



**关键组件：**

- **root代理进程ycsrootagent：执行硬件iofence命令的进程**  。
- **ycsrootagent文件：**     **执行硬件iofence命令的进程文件，可以直接用来执行命令。**
- **yascs进程**  ：  **下发硬件iofence命令给ycsrootagent。**






# 2、数据流图：

![安全分析数据流图.png](https://pingcode.yasdb.com/atlas/files/public/67adab6198ac295b69be0e17/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUNBQUFBUUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2MzEsImV4cCI6MTc4MjQ2NzQzMX0.mMG9Fkyw4gAstTcH23mIXG4-UG3xc7cjnxVJMc-bwzE)

# 3、使用STRIDE威胁模型

|编号  
|系统元素|仿冒（S）|篡改（T）|抵赖（R）|泄露（I）|拒绝服务（D）|权限提升（E）|
|:---|:---|:---|:---|:---|:---|:---|:---|
|1|用户||||威胁：用户通过ycsrootagent向共享存储下发恶意命令|||
|2|ycsrootagent||威胁：攻击者篡改yascs发送给ycsrootagent的命令，导致实际结果不符合预期。  
|威胁：用户或管理员声称未向共享存储下发命令，试图推卸责任。||  
|  
|
|3|yascs|威胁：攻击者仿冒 yascs进程，向ycsrootagent发送命令，破坏共享存储|||||威胁：攻击者通过漏洞或配置错误获取管理员权限，篡改规则或直接访问敏感数据。|




# 4、对威胁采取缓解措施

|组件|风险|缓解措施|
|---|---|---|
|用户|泄露：用户通过ycsrootagent向共享存储下发恶意命令|1）ycsrootagent通过打屏记录操作信息|
|ycsrootagent|篡改：攻击者篡改yascs发送给ycsrootagent的命令，导致实际结果不符合预期|1）日志审计，日志中记录向设备下发的命令码。,2）对yascs发送的数据进行完整性校验|
||抵赖：用户或管理员声称未向共享存储下发命令，试图推卸责任。|1）对所有用户操作记录进行日志记录|
|yascs|仿冒：攻击者仿冒 yascs进程，向ycsrootagent发送命令，破坏共享存储|1）采用magicnumber确认是否是yascs发送的请求。|




# **5、应采取的安全措施**

本威胁建模展示了硬件iofence功能可能面临的安全挑战并采取以下措施进行防范，将最大程度地帮助实现硬件iofence功能的安全性和合规性。

- 详细记录SCSI命令日志。
- ycsrootagent中对yascs发送的数据进行完整性校验。
- 对所有用户操作记录进行日志记录。
- 采用magicnumber确认是否是yascs发送的请求。











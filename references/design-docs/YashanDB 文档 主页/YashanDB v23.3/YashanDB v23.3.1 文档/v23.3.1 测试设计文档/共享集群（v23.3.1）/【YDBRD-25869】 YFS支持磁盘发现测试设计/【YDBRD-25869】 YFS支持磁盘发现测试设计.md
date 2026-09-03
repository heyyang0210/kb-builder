Created by 吕雷奇, last modified on 六月 05, 2024

## 1.   **概述**

本文描述  YFS 支持磁盘发现测试设计

## 2.   **需求分析**

本需求的开发设计：    [详细设计-YDBRD-25869 YFS支持磁盘发现 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150628461)  

特性sr连接：    [https://pingcode.yasdb.com/pjm/items/6611a8b5579a3edb84d860e9](https://pingcode.yasdb.com/pjm/items/6611a8b5579a3edb84d860e9)    ?    
  #YDBRD-25869 YFS支持磁盘发现

本需求是在YFS的运维能力的增强，主要对标Oracle rac ASM磁盘发现能力，可以自动发现可用磁盘。

调研文档：

  [【YDBRD-25869】YFS自动发现磁盘调研文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152995400)  

**支持功能：**

- 该功能支持指定路径（默认）下磁盘的自动发现；
- 挂载好磁盘后，可以通过以下方式触发磁盘自动发现功能：
    - 执行sql 挂载DG: ALTER DISKGROUP MOUNT
    - 执行sql online 磁盘: ALTER DISKGROUP ONLINE DISK   不支持
    - 执行sql 给DG添加磁盘: create or alter diskgroup ... add disk
    - 执行sql resize一个DG大小: alter diskgroup ... resize disk   不支持
    - 执行查询视图操作：SELECT FROM  V$YFS_DISK(没有使用的不会查到)。  （or V$ASM_DISKGROUP?)


**功能限制：**

- 各个节点间disk路径需要保持一致。
- 被发现磁盘需要有读写权限（  用户是否必须为当前用户？  ）。
- 发现磁盘必须在所有的yfs实例上都有挂载，并且有对应权限。
- 被发现磁盘名称可以不必相同（yac必须一样）。
- 各节点间只能保证每个diskgroup内，磁盘信息一致。无法保证节点间diskgroup数量丢失问题。如果某个节点，属于某个diskgroup的所有disk都丢失了。则无法加载该diskgorup；


新增配置参数

YFS_DISKSTRING string类型；修改方法可以通过alter system set YFS_DISKSTRING = 'discovery_string [, discovery_string ] ...' ,路径更新只能新增，不可以已经存在的路径删除(  是否支持alter session，不支持  )

discovery_string 为目录，可以使用通配符*（  ？是否支持，不支持相对路径  ）

视图新增字段（暂时没有）

V$YFS_DISK 中新增HEADER_STATUS字段，表示磁盘状态：

- 如果被发现磁盘是属于DG（disk name会在磁盘头），视图中header_status 字段显示为 MEMBER;
- 如果被发现的磁盘不属于任何DG，视图中header_status 字段显示为  CANDIDATE或者   PROVISIONED？  ；
- 如果被发现的磁盘原本属于DG，但是被删除后，状态字段显示为FORMER；


# **3. 详细测试方法**

3.1测试设计方法

业务场景通过场景法，参数校验通过边界值法测试；

  


3.2详细测试设计

参数校验：

|序号|场景|预期|备注|进展|
|---|---|---|---|---|
|1|部署4节点集群环境，在线修改  YFS_DISKSTRING   参数为正确路径|可以设置成功，通过v$yfs_disk视图查询到路径下挂载在DG的磁盘|  
|  
|
|2|部署4节点集群环境，在线修改  YFS_DISKSTRING   参数为不存在路径|设置失败报错，报错内容正常|  
|  
|
|3|部署4节点集群环境，在线修改  YFS_DISKSTRING   参数其中带？或者 * 通配符|可以正常设置成功，通过v$yfs_disk视图查询到路径，  ？暂时不支持|  
|报错|
|4|部署4节点集群环境，在线修改  YFS_DISKSTRING   参数为除统配符外的特殊字符|设置失败报错，报错内容正常|  
|  
|
|5|部署4节点集群环境，在线修改  YFS_DISKSTRING   参数为null|设置失败报错，报错内容正常|  
|  
|
|6|部署4节点集群环境，不同实例执行  YFS_DISKSTRING在线修改为不同路径|可以设置成功？|作为约束|  
|


视图验证：

|序号|场景|预期|备注|进展|
|---|---|---|---|---|
|1|部署4节点集群环境，查看V$YFS_DISK 视图|已经正常挂载的磁盘HEADER_STATUS显示为  MEMBER|  
|  
|
|~~2~~|~~部署4节点集群环境，存在之前使用过的磁盘，查看V$YFS_DISK 视图~~|~~对应磁盘状态为FORMER~~|  
|  
|
|~~3~~|~~部署4节点集群环境，存在新挂载的磁盘，查看V$YFS_DISK 视图~~|~~对应磁盘状态为CANDIDATE~~|  
|  
|
|4|部署4节点集群环境，在线修改  YFS_DISKSTRING   为新的路径，查看V$YFS_DISK 视图，使用新路径磁盘创建DG|历史的磁盘路径没有变更，新加入集群的磁盘可以查到|  
|  
|
|5|部署4节点集群环境，删除DG下挂载磁盘后，  查看V$YFS_DISK 视图|该视图不记录删除磁盘|  
|  
|
|5|~~部署4节点集群环境，存在之前使用过的磁盘，查看V$YFS_DISK 视图，使用该磁盘创建新的DG后~~|~~对应磁盘状态由FORMER改为MEMBER~~|  
|  
|
|6|~~部署4节点集群环境，存在新挂载的磁盘，查看V$YFS_DISK 视图，使用该磁盘给DG添加磁盘后~~|~~对应磁盘状态由CANDIDATE改为MEMBER~~|  
|  
|


业务场景：

|序号|场景|子项|预期|备注|进展|
|---|---|---|---|---|---|
|1|安装部署|使用yasboot 生成配置文件中  使用默认值|安装部署成功|  
|  
|
|2|  
|使用yasboot 生成配置文件中配置该参数|安装部署成功|  
|  
|
|3|基本功能验证|挂载好磁盘后，当前用户有读写权限，查询视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|4|  
|挂载好磁盘后，有读写权限，非当前用户和属组，查询视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|5|  
|挂载好磁盘后，当前用户有读写权限，执行ALTER DISKGROUP MOUNT，查询视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|6|  
|挂载好磁盘后，当前用户有读写权限，执行创建新的DG或者给磁阵加盘create or alter diskgroup ... add disk，查询视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|7|  
|给DG创建多副本，查看视图SELECT FROM  V$YFS_DISK，查询视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|8|  
|四实例集群，挂载磁盘路径一样，磁盘名称不一样|  
|约束|  
|
|9|  
|四实例集群，在线设置多个磁盘发现路径|可以查看到对应挂载的磁盘|  
|  
|
|10|  
|集群容灾部署下，主节点上挂载了读写权限磁盘，查看视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|11|  
|集群容灾部署下，备节点上挂载了读写权限磁盘，查看视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|12|  
|集群容灾部署下，主节点上挂载了读写权限磁盘，执行创建新的DG或者给DG加盘create or alter diskgroup ... add disk，查看视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|13|  
|集群容灾部署下，做failover后，在新主上执行创建新的DG或者给磁阵加盘create or alter diskgroup ... add disk，查看视图SELECT FROM  V$YFS_DISK|可以查看到对应挂载的磁盘|  
|  
|
|14|  
|四实例集群，挂载多块盘（10000块盘），在线设置多个磁盘发现路径，触发磁盘发现|可以查看到对应挂载的磁盘|如何构造？,最多65535块盘|  
|
|15|  
|多个DG，每个DG下多个FG，每个FG有多个盘，做增删磁盘后，查看视图SELECT FROM  V$YFS_DISK|磁盘记录位置正常，视图显示正确|  
|  
|
|16|  
|  
|  
|  
|  
|
|17|异常场景|挂载好磁盘后，当前用户有读权限没有写权限，查询视图SELECT FROM  V$YFS_DISK，修改为读写权限后，再次查询视图SELECT FROM  V$YFS_DISK|查看不到对应磁盘，修改后可以一查到对应磁盘|  
|  
|
|18|  
|挂载好磁盘后，当前用户有写权限没有读权限，查询视图SELECT FROM  V$YFS_DISK，修改为读写权限后，再次查询视图SELECT FROM  V$YFS_DISK|查看不到对应磁盘，修改后可以一查到对应磁盘|  
|  
|
|19|  
|四实例集群，挂载好磁盘后，一个实例上有读写权限，另外实例上没有权限，查询视图SELECT FROM  V$YFS_DISK|查看不到对应磁盘？|跟yfs主备是否有关？|  
|
|20|  
|四实例集群，挂载路径不一致|  
|约束|  
|
|21|  
|~~四实例集群，有两个实例上挂载了，另外实例没有挂载~~|~~查看不到对应磁盘~~|  
|  
|
|22|  
|挂载磁盘后，通过磁盘发现功能发现的磁盘，随后磁盘unmount，再查视图SELECT FROM  V$YFS_DISK|查看不到对应磁盘|  
|  
|
|23|  
|~~并发异常，磁盘发现过程中，kill ycs实例，重新拉起，再次触发磁盘发现（查视图SELECT FROM  V$YFS_DISK）~~|~~正常不报错，可以查看到对应磁盘~~|~~需要加断点？~~|  
|
|24|  
|~~并发异常，磁盘发现过程中，kill ycs实例，重新挂载了新的磁盘，重新拉起，再次触发磁盘发现（查视图SELECT FROM  V$YFS_DISK）~~|~~正常不报错，可以查看到对应磁盘~~|  
|  
|
|25|  
|磁盘发现过程中，发现所有DG的磁盘都unmount了，DG状态为unmount，部分磁盘unmount，DG状态需要细化|  
|  
|  
|
|26|  
|四实例下，设置多个磁盘路径后，多路径发现了同一块盘|视图可以正常查询到，只记录第一个路径下的磁盘，不影响现有数据库业务。|  
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
|3|并发|涉及|  
|
|4|HA|涉及|  
|
|5|安全|涉及|  
|
|6|一致性|不涉及|  
|
|7|压力|不涉及|  
|
|8|可维护性|涉及|  
|
|9|性能|不涉及|  
|


# **4.**  **详细测试设计**   

1.冒烟用例；

|序号|场景|预期|  
|
|---|---|---|---|
|1|部署4节点集群环境，查看V$YFS_DISK 视图|已经正常挂载的磁盘HEADER_STATUS显示为  MEMBER|  
|
|2|部署4节点集群环境，在线修改  YFS_DISKSTRING   参数其中带？或者 * 通配符|可以正常设置成功，通过v$yfs_disk视图查询到路径|  
|
|3|部署4节点集群环境，新挂载3块磁盘，所有实例均有读写权限，查看V$YFS_DISK 视图|可以正常查询到|  
|


2.用例

# **5.测试框架**

使用guider测试框架

# **6.测试环境**

本地测试环境，1台机器部署4实例；

# **7.工作量评估**

工作量：7人天

计划测试完成时间：

  


  


  


## Attachments:

[image2023-12-11_18-52-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzA4OTcwYzJhZjRmNTIxOGIyIiwicmVmX2lkIjoiNjczOTZlNzA1OTNmOTljOWZmMjM4NDhjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTI0LCJleHAiOjE3ODI0NTg1MjR9.cV7REQVpmhlCYBa2lVRGHjZtNuFxwn78eMW-BwXqHNk)

 (image/png)    


[image2023-12-11_18-46-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzBhMWFkOWEzMzExZGM5NzI2IiwicmVmX2lkIjoiNjczOTZlNzA1OTNmOTljOWZmMjM4NDhjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTI0LCJleHAiOjE3ODI0NTg1MjR9.N6tQJVX6w7C7RbUu9gq7wWudykSvA9Y66qC0Tx3EFLc)

 (image/png)    


[split_table_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzA4OTcwYzJhZjRmNTIxOGIzIiwicmVmX2lkIjoiNjczOTZlNzA1OTNmOTljOWZmMjM4NDhjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTI0LCJleHAiOjE3ODI0NTg1MjR9.7Se9m9Zw1_C3qc5kd59ginbgwSjdvL2poimw1odPuD0)

 (image/gif)    


[集群支持split分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzBhMWFkOWEzMzExZGM5NzI3IiwicmVmX2lkIjoiNjczOTZlNzA1OTNmOTljOWZmMjM4NDhjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTI0LCJleHAiOjE3ODI0NTg1MjR9.GuT4iPYpXVRKGehtY9Rz6qF7vmweCbPfps3orTDwg8k)

 (application/x-xmind)    


[image2023-11-7_9-36-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzA4OTcwYzJhZjRmNTIxOGI0IiwicmVmX2lkIjoiNjczOTZlNzA1OTNmOTljOWZmMjM4NDhjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTI0LCJleHAiOjE3ODI0NTg1MjR9.U6mR8M1IOeHiUxZ8aaIuGlpnnv3memn285U3cxKxJac)

 (image/png)    

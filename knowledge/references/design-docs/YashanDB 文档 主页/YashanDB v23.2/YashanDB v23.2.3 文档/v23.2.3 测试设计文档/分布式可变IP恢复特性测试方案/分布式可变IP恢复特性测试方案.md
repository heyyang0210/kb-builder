Created by 董灵林, last modified on 五月 27, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

分布式备份需要备份节点的部署形态、节点ip、端口等详细部署配置，恢复时候可指定部署配置文件，支持修改原有部署ip节点。

SR链接：    [https://pingcode.yasdb.com/pjm/items/661510d3fd997db58ad66147](https://pingcode.yasdb.com/pjm/items/661510d3fd997db58ad66147)    ?    
  #YDBRD-26366 使用备份集恢复支持从om获取恢复节点的ip

开发设计文档：    [分布式可变IP恢复特性设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150604917)  

# 2. 需求分析

本次需求主要解决分布式节点发生地址变更（节点替换）的情景

|命令|命令分支|是否变更|变更点|  
|
|---|---|---|---|---|
|### yasbak deploy|  
|否|  
|  
|
|### yasbak run|configure 设置参数|是|命令新增 configure dstb_nodes命令，用于配置分布式节点配置文件|  
|
|  
|show all 展示配置参数|是|添加dstb_nodes展示项|  
|
|  
|backup cluster 备份集群|否|  
|  
|
|  
|restore cluster 恢复集群|是|根据dstb_nodes配置配置的IP、端口进行恢复|  
|
|  
|list backup 展示备份集信息|否|  
|  
|
|  
|delete backupset 删除备份集|否|  
|  
|
|**yasbak reset**|  
|新增命令|底层调用configure dstb_nodes命令，用于配置分布式节点配置文件|  
|
|### yasbak clean|  
|否|  
|  
|


约束：

1. 若是增量备份，增量备份期间不能做表空间迁移、扩容、缩容。比如先做level 0备份，然后执行扩缩容或者表空间迁移，然后无法继续再执行level 1备份。（以前未拦截，扩容的新节点找不到极限备份集自动报错，缩容无法检测到）
1. 相比较备份集的部署发生了扩容或者缩容。执行恢复前，需要将分布式的部署模式恢复至与备份时的部署模式一致。否则无法恢复。
1. 如果节点所在机器发生变更，需要将节点对应的备份文件复制到新机器，并且保证节点已经安装好，恢复时处于nomount状态，否则无法恢复


分布式节点配置文件格式：

```
nodeCount=15 ，可选待考虑
node=1-1, type=MN, url=127.0.0.1:1678
node=1-2, type=MN, url=127.0.0.1:1681
node=1-3, type=MN, url=127.0.0.1:1684
node=2-1, type=CN, url=127.0.0.1:1688
node=2-2, type=CN, url=127.0.0.1:1691
node=2-3, type=CN, url=127.0.0.1:1694
node=3-1, type=DN, url=127.0.0.1:1698
node=3-2, type=DN, url=127.0.0.1:1701
node=3-3, type=DN, url=127.0.0.1:1704
node=4-1, type=DN, url=127.0.0.1:1707
node=4-2, type=DN, url=127.0.0.1:1710
node=4-3, type=DN, url=127.0.0.1:1713
node=5-1, type=DN, url=127.0.0.1:1716
node=5-2, type=DN, url=127.0.0.1:1719
node=5-3, type=DN, url=127.0.0.1:1722
```

分布式节点配置文件约束：

1. 节点数量不能发生变更
1. node、type字段内容不能变更，url可变


  


# 3. 详细测试设计

## 3.1 测试设计方法

- 功能验证：边界值、等价类划分，正交法
- 性能验证：典型场景设计
- 可靠性：等价类划分、场景组合


## 3.2 详细测试设计

|序号|测试分类|功能点|测试点|备注|
|---|---|---|---|---|
|1|功能测试|configure dstb_nodes命令|1.指定正常路径|  
|
|2|  
|  
|2.不指定配置文件路径|  
|
|3|  
|  
|3.指定路径不存在、路径没有权限等|  
|
|4|  
|  
|4.指定路径名非法|  
|
|5|  
|show all|展示信息增加dstb_nodes配置文件路径展示项|  
|
|6|  
|yasbak reset|与configure dstb_nodes命令效果相同|  
|
|7|  
|基础场景，不重新安装数据库|1.基线备份 + 变更节点IP（比如127.0.0.1改为192.168.6.165）+ 增量备份 + 恢复，预期恢复成功|分布式不支持,无法执行，改为修改配置文件，重新安装|
|8|  
|  
|2.基线备份 + 变更节点端口 + 增量 + 恢复，预期恢复成功||
|9|  
|增强场景1 ，重新安装数据库|1.使用hosts.toml和cluster.toml配置安装集群A + 备份 + 卸载集群A，修改cluster.toml中部分节点端口号，安装集群B + 恢复，预期恢复成功|  
|
|10|  
|  
|2.使用hosts.toml和cluster.toml配置安装集群A + 备份 + 卸载集群A，修改cluster.toml中部分节点IP，安装集群B + 恢复，预期恢复失败（需要手工将对应备份文件复制到相应节点）|  
|
|11|  
|  
|3.使用hosts.toml和cluster.toml配置安装集群A + 备份 + 卸载集群B，修改cluster.toml中部分节点IP，安装集群B +手工复制修改IP的节点备份数据到新节点所在机器 + 恢复，预期恢复成功|尚未实现|
|12|  
|  
|4.使用hosts.toml和cluster.toml配置安装集群A + 备份 + 卸载集群B，修改hosts.toml和cluster.toml，将部分节点迁移到新机器，安装集群B +手工复制修改IP的节点备份数据到新节点所在机器 + 恢复，预期恢复成功|  
|
|13|  
|增强场景2 ，同名集群迁移|1.安装两个集群，除了IP和端口 差异外，两个集群节点ID和部署路径都一致 + 第一个集群备份 + 手动修改dstb_nodes的IP端口为第二个集群 + 恢复，预期恢复失败（目前分布式只支持server端部署，第二个集群上面没有相应的备份文件）|  
|
|14|  
|  
|2.安装两个集群，除了IP和端口 差异外，两个集群节点ID和部署路径都一致 + 第一个集群备份 + 手动修改dstb_nodes的IP端口为第二个集群 + 手工复制备份文件到第二个集群，保持备份文件路径一致 + 恢复，预期恢复成功|  
|
|15|  
|约束场景1 扩缩容|1.基线备份 + 扩容 + 增量备份，预期增量备份失败 （目前不支持扩容场景）|已有用例，跑自动化即可|
|16|  
|  
|2.基线备份 + 缩容 + 增量备份，预期增量备份失败 （目前不支持缩容场景）||
|17|  
|  
|3.基线备份 + 扩容 + 缩容（缩容后节点与基线备份节点ID、类型完全一致） + 增量备份 + 恢复，预期备份恢复成功||
|18|  
|约束场景2 表空间迁移|1.基线备份 + 表空间迁移 + 增量备份，预期增量备份失败 （目前不支持表空间迁移）|  
|
|19|  
|  
|2.基线备份 + 表空间迁移 + 恢复，预期恢复成功（表空间迁移不影响恢复，因为恢复时数据文件已经被删除）|  
|
|20|  
|约束场景3 dstb_nodes配置文件格式约束|1.基线备份 + 手工修改dstb_nodes配置节点数 + 恢复，预期恢复失败（配置文件约束）|  
|
|21|  
|  
|2.基线备份 + 手工修改dstb_nodes配置node id + 恢复，预期恢复失败（配置文件约束）|  
|
|22|  
|  
|3.基线备份 + 手工修改dstb_nodes配置节点类型 + 恢复，预期恢复失败（配置文件约束）|  
|
|23|  
|  
|4.基线备份 + 手工修改dstb_nodes配置IP、端口 + 恢复，预期恢复成功|手工修改IP比较难，因为与增强测试场景1有重合，该测试点没有再用yasrman实现|
|24|  
|  
|5.基线备份 + 手工修改dstb_nodes配置，在节点配置中加入空行 + 恢复，预期恢复失败|  
|
|25|  
|  
|6.基线备份 + 手工修改dstb_nodes配置，将其中两行去除换行合并为一行 + 恢复，预期恢复失败|  
|
|26|  
|  
|7.基线备份 + 手工修改dstb_nodes配置，将键值对中间的等号改为冒号 + 恢复，预期恢复失败|  
|
|27|  
|  
|8.基线备份 + 手工修改dstb_nodes配置，删除/增加node、type、URL配置项中间的空格 + 恢复，预期恢复成功|  
|
|28|  
|  
|9.基线备份 + 手工修改dstb_nodes配置文件，使当前用户无访问权限 + 恢复，预期恢复失败|  
|
|29|  
|  
|10.基线备份 + 手工修改删除dstb_nodes配置文件 + 恢复，预期恢复失败（实际恢复成功）|  
|
|30|  
|约束场景4 备份集完整性|1.基线备份 + 手工修改备份集名称 + 恢复，预期恢复失败|mv命令修改备份集文件夹名称    
    
|
|31|  
|  
|2.增量备份3次（命名为A、B、C、），删除备份集C + 修改备份集B名字为备份集C + 恢复备份集C，预期恢复失败||
|32|  
|  
|3.增量备份3次（命名为A、B、C、），删除备份集B，修改备份集C名字为备份集B + 恢复备份集B，预期恢复失败||
|33|故障场景|约束场景5 主备切换|1.基线备份 + MN主备切换 + 增量备份，预期增量备份失败|已有用例，跑自动化即可|
|34|  
|  
|2.基线备份 + DN主备切换 + 增量备份，预期增量备份失败||
|35|  
|  
|3.基线备份 + MN主备切换 + 恢复，预期恢复成功||
|36|  
|  
|4.基线备份 + DN主备切换 + 恢复，预期恢复成功||
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


# 4. 测试用例

[分布式可变IP恢复测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWE4OTcwYzJhZjRmNTIxMDRkIiwicmVmX2lkIjoiNjczOTZkMWE3MjgyMDZlZmI5MmYxYjM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODQxLCJleHAiOjE3ODIzOTIyNDF9.KwJyDLvN4wcjMHTQ4p5b0h3icKtXlxp0RkZ4SPMBceA)

  


  


  


  


## Attachments:

[备份还原质量加固测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWE4OTcwYzJhZjRmNTIxMDRlIiwicmVmX2lkIjoiNjczOTZkMWE3MjgyMDZlZmI5MmYxYjM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODQxLCJleHAiOjE3ODIzOTIyNDF9._O-2phQJ-r4nEmiiaz5iEGqsXUeEfQKszgIW0s5Xpwc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式可变IP恢复测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWE4OTcwYzJhZjRmNTIxMDRkIiwicmVmX2lkIjoiNjczOTZkMWE3MjgyMDZlZmI5MmYxYjM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODQxLCJleHAiOjE3ODIzOTIyNDF9.KwJyDLvN4wcjMHTQ4p5b0h3icKtXlxp0RkZ4SPMBceA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  参与人：朱国旭、张旭涛、施新华，刘美秀、董灵林    
  时间：2024-04-18 16:00-17:00    
  地点：线上会议    
  1.原有yasbak restore命令改名为yasbak reset，清理数据库数据文件并自动生成dstb_nodes配置文件    
  2."约束场景4"第二个用例没有命中本次SR场景，需要修改    
  3.分布式目前不支持在线变更IP，因此"基础场景"中的两条用例需要改为修改配置文件重新安装    
  4.重新安装后的集群，要重新执行yasbak deploy,Posted by donglinglin at 四月 23, 2024 11:25|
|---|

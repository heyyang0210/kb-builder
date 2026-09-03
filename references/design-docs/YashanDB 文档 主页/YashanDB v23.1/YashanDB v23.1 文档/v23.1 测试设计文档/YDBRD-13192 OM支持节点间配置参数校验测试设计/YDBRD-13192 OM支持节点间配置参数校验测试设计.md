Created by 李世铭, last modified on 十月 31, 2023

# 1.     **概述**

完善节点配置修改的能力，包括节点，组内和集群粒度的配置参数修改。同时对多节点粒度级别的修改能够支持回滚等能力。

# 2.     **需求分析**

  [YDBRD-13192](https://jira.yasdb.com/browse/YDBRD-13192?src=confmacro)    **-**  **【OM】OM支持节点间配置参数校验**  **完成**

**设计文档：**    [节点间配置参数修改设计文档](112726827.html)  

### **2.1 功能分析**

1. 提供修改配置参数能力
1. 支持普通参数修改（对接alter system命令）
1. 可以支持集群、节点组、节点三级修改
1. 对个别参数进行特殊处理
    1. DIN_CONNECTIONS_PER_NODE，整个集群同时修改
    1. DEFAULT_TABLE_TYPE，整个集群同时修改
    1. HA_ELECTION_ENABLED，整个节点组同时修改
    1. HA_ELECTION_TIMEOUT，整个节点组同时修改
    1. HA_ELECTION_LEADER_LEASE_ENABLED，整个节点组同时修改
    1. HA_HEARTBEAT_INTERVAL，整个节点组同时修改
    1. QUORUM_SYNC_STANDBYS，整个节点组同时修改
    1. 设置主备复制保护模式，整个节点组同时修改（单机场景）
    1. 对MAX_WORKERS/MAX_SESSIONS/MAX_REACTOR_CHANNEL联动修改（分布式，见    [session worker 使用方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109592338)  
1. 资料引导用户使用OM修改个别参数


### **2.2 约束**

（1）个别参数修改流程

1. 查看相关节点在线情况，如果不满足条件提示报错
1. 先查询各节点配置值，本地记录下来
1. 通过SQL修改各节点参数（已经修改的节点可以跳过）
1. 再次查询各节点修改情况，如果有个别节点修改没成功，需要进行重试，重试失败后需要报错说明哪些没修改成功
1. 支持特殊选项，个别节点修改失败后，整体回滚旧值
1. 支持强制选项，如果个别节点不在线，可以直接改配置文件


 （2）回滚参数和强制参数不支持同时出现。

1. 强制修改失败的，回滚极大概率也是失败。


（3）部分系新增配置项的scope界定

（4）设置主备复制保护模式，整个节点组同时修改（单机场景），该参数是通过单独sql执行，de和ce不支持

（5）对于原有的参数设置流程，仅对特殊参数进行查询并限制，对于普通参数（仅增加回滚功能，如集群修改listen_addr不会直接报错，会在执行完成后进行报错）。

# 3.   **测试设计方法**

主要采用场景法，边界值法等进行测试设计   

# 4.   **详细测试设计**

## Attachments:

[OM支持节点间配置参数校验.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzU4OTcwYzJhZjRmNTFmODMwIiwicmVmX2lkIjoiNjczOTY5NzU1OTNmOTljOWZmMjM0ZjE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODIxLCJleHAiOjE3ODIyOTMyMjF9.bJjrmyvQoS1yhYOh4hbgVckcIic0QgAiv9fZGnx0xy0)

 (application/x-xmind)    


[OM支持节点间配置参数校验.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzVhMWFkOWEzMzExZGM3NmE1IiwicmVmX2lkIjoiNjczOTY5NzU1OTNmOTljOWZmMjM0ZjE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODIxLCJleHAiOjE3ODIyOTMyMjF9.0TI-ERdw5aouAnXIdBW0rcqQhh-G5D8OPrz7GnCkUZw)

 (application/x-xmind)    

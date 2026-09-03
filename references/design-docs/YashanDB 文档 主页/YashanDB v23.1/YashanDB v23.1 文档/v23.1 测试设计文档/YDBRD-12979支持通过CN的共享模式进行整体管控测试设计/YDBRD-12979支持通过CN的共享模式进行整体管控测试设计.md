Created by 张地强, last modified by  施新华 on 十一月 14, 2023

# 1.   **概述**

在分布式环境中，不对worker的使用实现精准的限制，会出现一些死锁问题，为了更好地管理worker，避免死锁问题的出现，对于会话的worker使用需要更加准确的控制，合理地控制并发数。

SR：    [YDBRD-12979](https://jira.yasdb.com/browse/YDBRD-12979?src=confmacro)    -  支持通过CN的共享模式进行整体管控  完成

# 2.   **需求分析**

### **2.1 功能分析**

1. CN data connection连接池与CN max worker数相等，DN使用专用模式，DN会话数 = 各CN data connection连接池之和，解决调度死锁问题，以及DN上资源管控因为线程切换导致的性能问题
1. 引入活跃会话概念，表示占有worker的会话，DN的max workers需要慎重考虑，针对业务特点，以及DN硬件能力判断进行调优
1. 会话建立连接和上一次断联合并，减少消息的交互


### 2.2 规格约束

1. 要求DN上的参数配置，必须和CN相协同(需要DN上的max_worker >= CN max_workers 之和) 由配置实现控制
1. CN限制只允许使用共享模式（简化用户配置复杂度）


# **3. 测试组网**

1mn1cn3dn

# 4.   **测试设计方法**

等价类法：包括cn、dn、mn、session、worker等不同等价类

场景法：包括单节点场景、多节点场景等不同场景

边界值法：包括worker、session及其组合等参数边界值

# 5.   **详细测试设计**

** **  **电子表格**

[支持通过CN的共享模式进行整体管控.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzA4OTcwYzJhZjRmNTFmODI0IiwicmVmX2lkIjoiNjczOTY5NzA1OTNmOTljOWZmMjM0ZWYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NTUwLCJleHAiOjE3ODIyMTM5NTB9.Ey7hgqO9C8boa9kjrjz80T1TDLHw_po0o4uiEhtRBkQ)

# 6.   **测试用例**

# 7.   **测试框架设计**

先完成手动测试，暂不考虑自动化

# 8.   **测试环境说明**

|服务器类型|操作系统|服务器个数|
|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|2|


## Attachments:

[支持通过CN的共享模式进行整体管控.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzA4OTcwYzJhZjRmNTFmODI0IiwicmVmX2lkIjoiNjczOTY5NzA1OTNmOTljOWZmMjM0ZWYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NTUwLCJleHAiOjE3ODIyMTM5NTB9.Ey7hgqO9C8boa9kjrjz80T1TDLHw_po0o4uiEhtRBkQ)

 (application/x-xmind)    


[文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzBhMWFkOWEzMzExZGM3NjljIiwicmVmX2lkIjoiNjczOTY5NzA1OTNmOTljOWZmMjM0ZWYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NTUwLCJleHAiOjE3ODIyMTM5NTB9.-NUDZltX2lxgoiOhS1RFT2z9exidMABI9ZWY6sABmeg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    

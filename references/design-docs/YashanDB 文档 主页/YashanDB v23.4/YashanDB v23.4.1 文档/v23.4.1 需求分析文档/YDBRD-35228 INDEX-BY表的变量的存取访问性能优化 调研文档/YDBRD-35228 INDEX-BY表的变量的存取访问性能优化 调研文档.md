Created by 张欣, last modified on 十一月 15, 2024

**目的：**    
  1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等    
  2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)    
  3.给测试概要设计和测试详细设计做输入

# 1. 需求概述

*需求与场景概述*

# 2. 友商的实现情况

1.融选场景

|  
|oracle|DM|yashan(优化前)|  
|
|---|---|---|---|---|
|insert|  
|  
|  
|  
|
|查找|Elapsed: 00:00:00.08  
|  
|Elapsed: 00:00:00.319  
|  
|
|修改|Elapsed: 00:00:00.08  
|  
|Elapsed: 00:00:00.444  
|  
|
|copy|Elapsed: 00:00:21.01  
|  
|Elapsed: 00:01:06.804 （初始化后首次执行）  
 |  
|


# 3. 示例

  [测试脚本.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc5MjBkZmQ5OGFjMjk1YjY5YmUwYWNmIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NDE1LCJleHAiOjE3ODI1NDE4MTV9.O32nJzcfDK7bAh39fIbq3Ok_buIpwJoGurzefGtc1CY)  

# 4. 参考文档

*链接*

# 5. 后续关注(可选)

*后续测试设计与执行过程中需跟友商做细化对比的内容*
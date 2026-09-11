Created by 周彬鑫, last modified on 十月 16, 2024

# 1. 概述

IPV6地址空间数量巨大，支持自动编址，更加安全和高效，在数据库内部兼容ipv6通信有利于扩展产品应用场景和提升竞争力。

IPV6地址类型多样，包括组播、任播和各类单播地址；单播地址中的链路本地地址、唯一本地地址和环回地址是本次兼容的ipv6地址格式。

# 2. 需求分析

## 2.1 功能点分析

单机与分布式数据库均支持配置ipv6的DIN_ADDR、LISTEN_ADDR、REPLICATION_ADDR，且： 

1. 数据库能够正常拉起并执行数据库事务；
1. 数据库的ip相关log文件和ip相关视图能够正确展示ipv6地址；
1. 分布式数据库能够正确执行主备切换；
1. yasdb功能上支持不同节点之间混用ipv4和ipv6协议，但不建议；


    - 单机与分布式数据库均支持通过ipv6连接并执行yasrman备份和恢复；
    - 单机与分布式数据库均支持通过ipv6连接并执行yasldr数据导入；
    - 单机数据库支持在白名单中添加ipv6地址并正确屏蔽或通过ipv6地址的连接请求；


|功能|形态|是否支持|
|:---|:---|:---|
|数据库部署|单机|√|
||分布式|√|
|ip相关视图和log|单机|√|
||分布式|√|
|yasrman|单机|√|
||分布式|√|
|yasldr|单机|√|
||分布式|√|
|白名单|单机|√|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

主采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|部署形态|测试点|测试进展|备注|  
|
|:---|:---|:---|:---|:---|
|单机|白名单支持IPV6|1.IPV4、IPV6混用报错,2.白名单中有单个IP，该IP连接成功，其他IP连接失败,3.白名单中有多个IP，在其中的某个IP连接成功、其他IP连接失败,4.部署主机IP为映射地址，白名单可同时支持IPV4、IPV6？,5.白名单中存在  **非法地址格式,**  合理报错,6.白名单中TCP.VALIDNODE_CHECKING不为YES,，白名单不启用,7.关注掩码  fc00:18::/64的白名单，fc00:18::190和fc00:18::191都能连接，而fc00:7::126不行|1. IPV4、IPV6混用不报错
1. 白名单内不支持ip地址加[]
1. 测试已完成
|  
|
|  
|yasrman|参照文档测试备份恢复,  [yasrman | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasrman/yasrman%E5%8D%95%E6%9C%BA%E6%93%8D%E4%BD%9C%E7%A4%BA%E4%BE%8B.html)  |1.yasrman configure没有对非法地址格式做出拦截    [[YDBRD-18210] 【yasdb系统进程支持ipv6】yasrman配置备份功能时，使用非法的ipv6地址没有拦截 - SICS-CoD Jira](https://jira.yasdb.com/browse/YDBRD-18210)  ,2.测试已完成|  
|
|  
|yasldr|1.BASIC导入,2.BATCH导入|已覆盖四种地址类型|  
|
|  
|全部IP相关视图检查IPV6格式|V$SESSION、V$NODE、V$DIN_STAT、V$DIN_NODE、V$CM_NODE_INFO、V$ARCHIVE_DEST_STATUS、V$ARCHIVE_DEST、DV$REPLICATION_STATUS、    
  DV$ARCHIVE_DEST_STATUS、DV$NODE、UNIFIED_AUDIT_TRAIL、DV$DIN_NODE、DV$ARCHIVE_DEST (  **DV$为分布式视图**  )|测试已完成|  
|
|  
|log检查|listen.log、slow.log|已覆盖四种地址类型|  
|
|单机一主两备|同上|  
|  
|  
|
|分布式|同上|  
|  
|  
|
|集群|同上|  
|  
|  
|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


[yasdb系统进程支持IPV6测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzE4OTcwYzJhZjRmNTFmODJhIiwicmVmX2lkIjoiNjczOTY5NzE1OTNmOTljOWZmMjM0ZWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NjA1LCJleHAiOjE3ODIyMTQwMDV9.y6VogA-RZb3H1AGPFs8p_4aJu-JxCzA5yTpy_KdTYVo)

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

# 5. 测试框架设计

- *使用install_test框架和exp_imp_test框架实现自动化，实现过程见下面链接*
-   [yasldr支持ipv6自动化 - 周彬鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127650490)  
-   [yasrman支持ipv6自动化 - 周彬鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130145914)  
-   [白名单支持IPV6自动化 - 周彬鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130122897)  


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群、分布式|


  


  


## Attachments:

[yasdb系统进程支持IPV6测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzE4OTcwYzJhZjRmNTFmODJhIiwicmVmX2lkIjoiNjczOTY5NzE1OTNmOTljOWZmMjM0ZWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NjA1LCJleHAiOjE3ODIyMTQwMDV9.y6VogA-RZb3H1AGPFs8p_4aJu-JxCzA5yTpy_KdTYVo)

 (application/x-xmind)    


## Comments:

|  [](null)  ,1、分布式上：DN 将 CN 拉黑，CN 和 DN 内部通信不受影响，且基本业务正常（增删改查）,2、HA：DN 备将 DN 主拉黑，主备 内部通信不受影响，且基本业务正常（增删改查）,Posted by liuxiaoxuan at 十二月 13, 2023 17:50|
|---|

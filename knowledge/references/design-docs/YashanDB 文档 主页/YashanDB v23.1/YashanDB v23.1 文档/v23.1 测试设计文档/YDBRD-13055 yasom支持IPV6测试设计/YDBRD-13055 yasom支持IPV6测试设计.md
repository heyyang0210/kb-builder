Created by 周彬鑫, last modified on 十月 16, 2024

# 1. 概述

IPV6地址空间数量巨大，支持自动编址，更加安全和高效，在数据库内部兼容ipv6通信有利于扩展产品应用场景和提升竞争力。

IPV6地址类型多样，包括组播、任播和各类单播地址；单播地址中的链路本地地址、唯一本地地址和环回地址是本次兼容的ipv6地址格式。

# 2. 需求分析

## 2.1 功能点分析

- 支持在单机、分布式、集群类型下，通过ipv6地址生成配置文件。在package config gen命令中，对于ipv6，也支持使用    `[::[1-3]]`    这种多个ip地址的简写。对于    `[::ffff:127.0.0.1]`    这种IPv4映射IPv6地址，既支持在ipv6中使用，也支持在ipv4中使用，不算混用。


```
..<span class="hljs-regexp" style="color: rgb(188,96,96);">/bin/</span>yasboot <span class="hljs-keyword">package</span> config gen -c de --host <span class="hljs-string" style="color: rgb(136,0,0);">liushunpeng:</span>lsp@[::<span class="hljs-string" style="color: rgb(136,0,0);">ffff:</span><span class="hljs-number" style="color: rgb(136,0,0);">127.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.1</span>],[<span class="hljs-string" style="color: rgb(136,0,0);">fe80:</span>:<span class="hljs-number" style="color: rgb(136,0,0);">20</span><span class="hljs-string" style="color: rgb(136,0,0);">c:</span><span class="hljs-number" style="color: rgb(136,0,0);">29</span><span class="hljs-string" style="color: rgb(136,0,0);">ff:</span><span class="hljs-string" style="color: rgb(136,0,0);">fe75:</span>[<span class="hljs-number" style="color: rgb(136,0,0);">582</span>b<span class="hljs-number" style="color: rgb(136,0,0);">-582</span>d]%ens33] -t de
..<span class="hljs-regexp" style="color: rgb(188,96,96);">/bin/</span>yasboot <span class="hljs-keyword">package</span> config gen -c de --host <span class="hljs-string" style="color: rgb(136,0,0);">liushunpeng:</span>lsp@[::<span class="hljs-string" style="color: rgb(136,0,0);">ffff:</span><span class="hljs-number" style="color: rgb(136,0,0);">127.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.1</span>],<span class="hljs-number" style="color: rgb(136,0,0);">127.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.2</span> -t de 


```

- 支持使用ipv6中的环回地址、唯一本地地址和链路本地地址。
- yasboot、yasom、yasagent自身支持ipv6。


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

主采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|部署形态|测试点|测试进展|备注|  
|
|:---|:---|:---|:---|:---|
|单机|单机部署|package config gen,package  se gen,覆盖  **四种地址类型**,覆盖  **非法地址格式**  或无法连接的地址|唯一本地地址,环回地址,非法地址格式,链路本地地址,IPV4映射IPV6地址|**四种地址类型：**,1.链路本地地址：fe80开头，需要标识网络接口号 如：fe80::d5a0:6043:483c:4bfd%ens192,2.唯一本地地址：全局唯一但不被路由到Internet上，应用于企业站点内部或限制在某些网络内部，类似192.168网段,3.环回地址：与ipv4中的127.0.0.0/8类似，用于主机向自身收发数据包,4.ipv4映射ipv6地址：[::ffff:127.0.0.1]（不属于IPV4、IPV6混用）,**非法地址格式：**,1.带端口号不加[]，报错,2.9组4位16进制地址或7组4位16进制地址,3.地址中含有不为16进制字母,4.地址中出现多次连续省略0,5.地址中出现非法字符- | ( ) + _ * / \ = & ^ % $ # @ ！ ~ · 中文,6.一组地址中超过4位|
|  
|其他单机支持的yasboot命令|group config show 展示节点组配置信息,host info -n查看当前主机网络信息,yasboot sql -d username/password@127.0.0.1:1688指定IP:PORT连接yasql客户端,yasboot whitelist 白名单管理,yasboot config node gen 配置管理,check collect 主机检查,process yasom/yasagent/yasdb status,process yasom/yasagent/yasdb stop/start/restart,以及其他|1.config node gen 多个连续主机缩写拦截（原先IPV4也不支持，故不做处理）,测试已完成,  
|  
|
|单机一主两备|同上|  
|  
|  
|
|分布式|同上|具体命令按照分布式对应命令|  
|  
|
|集群|同上|具体命令改为集群对应命令|  
|  
|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


[yasom支持IPV6.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzFhMWFkOWEzMzExZGM3NmEyIiwicmVmX2lkIjoiNjczOTY5NzE3MjgyMDZlZmI5MmVmMzhhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NjI2LCJleHAiOjE3ODIyMTQwMjZ9.pQ5hF9ZaIqDYvoZIXzjQ6b_uJS5dXUE-4M7jOsqRBOA)

1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


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

*使用install_test框架实现自动化，实现过程见下面链接*

  [yasom支持IPV6-实现自动化 - 周彬鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127639323)  

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群、分布式|


## Attachments:

[yasom支持IPV6.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzFhMWFkOWEzMzExZGM3NmEyIiwicmVmX2lkIjoiNjczOTY5NzE3MjgyMDZlZmI5MmVmMzhhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NjI2LCJleHAiOjE3ODIyMTQwMjZ9.pQ5hF9ZaIqDYvoZIXzjQ6b_uJS5dXUE-4M7jOsqRBOA)

 (application/x-xmind)    

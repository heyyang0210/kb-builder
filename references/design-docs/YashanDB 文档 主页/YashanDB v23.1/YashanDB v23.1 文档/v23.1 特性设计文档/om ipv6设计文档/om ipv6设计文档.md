Created by 刘顺鹏 on 八月 31, 2023

##   [1. OverView（概述）](#1-overview概述)  

本方案对yasboot、yasom、yasagent以及依赖的yassh、yasrpc、yasdb-go做出调研和修改，使yasom整体可以通过ipv6进行通信。此外，支持通过yasboot安装部署支持ipv6通信的yasdb。

为了配合数据库的具体应用场景，yasom整体仅支持以下三种ipv6地址：

|地址类型|前缀标识|举例|应用场景|备注|
|---|---|---|---|---|
|链路本地地址|FE80::/10|[fe80::20c:29ff:fe75:582b%ens33]|作用范围只在链路本地同一广播域下，默认自动分配|自动生成（也可手动配置）|
|唯一本地地址|FC00::/7|[fc00:12::166]|全局唯一但路由范围限制在私网内部，如公司，需配置|手动配置    [https://conf.yasdb.com/pages/viewpage.action?pageId=122063617](https://conf.yasdb.com/pages/viewpage.action?pageId=122063617)  |
|环回地址|::1/128|[::1]|数据包不离开计算机，本机收发||
|ipv4映射ipv6地址|[::ffff:]|[::ffff:127.0.0.1]|使用这个地址的程序既在127.0.0.1提供ipv4服务，也在[::ffff:127.0.0.1]提供ipv6服务。||


ipv6地址使用16进制表示，前导0可以省略，多个段为0则可以用    `::`    省略，但是只允许出现一次。链路本地地址需要带上接口标识符（网卡号）(例如%ens33)。

##   [2. Feature（功能特性）](#2-feature功能特性)  

- 支持在单机、分布式、集群类型下，通过ipv6地址生成配置文件。在package config gen命令中，对于ipv6，也支持使用    `[::[1-3]]`    这种多个ip地址的简写。对于    `[::ffff:127.0.0.1]`    这种IPv4映射IPv6地址，既支持在ipv6中使用，也支持在ipv4中使用，不算混用。


```
../bin/yasboot package config gen -c de --host liushunpeng:lsp@[::ffff:127.0.0.1],[fe80::20c:29ff:fe75:[582b-582d]%ens33] -t de
../bin/yasboot package config gen -c de --host liushunpeng:lsp@[::ffff:127.0.0.1],127.0.0.2 -t de 


```

- 支持使用ipv6中的环回地址、唯一本地地址和链路本地地址。
- yasboot、yasom、yasagent自身支持ipv6。


##   [3. Interfaces （接口）](#3-interfaces-接口)  

yasboot config gen 新增参数：

|序号|长参|短参|说明|是否必填|
|---|---|---|---|---|
|1|--ipv6||用于本地安装时选择使用ipv6本地地址，默认ipv4。|否|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 不允许混用ipv6和ipv4。config gen会拦截ip协议混用。为了防止用户手动修改toml文件，在package install时会判断hosts.toml中有无ip混用。在package deploy时判断yashandb.toml有无ip混用。deploy之后，用户修改toml，导致toml中各个dn之间ip混用，也不会对dn实际的ip地址造成影响。
- 使用16进制表示ipv6地址。
- 仅支持环回地址[::1]，链路本地地址（例如[fe80::20c:29ff:fe75:582b%ens33]）和唯一本地地址（例如[fc00:12::166]） 。ipv6地址需要中括号包住，如果是链路本地地址，还需要接口标识符（网卡号）。ipv6地址必须满足规范。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

####   [5.1.1 总体流程图](#511-总体流程图)  

####   [5.1.2 package config gen 对 --host参数的解析](#512-package-config-gen-对---host参数的解析)  

1. 切割ip地址（可能是多个）、端口号（可能不存在）和安装目录。


-   `[::1],[::2],[::3]:/home/yasdb_home`  
-   `[::1],[::2],[::3]:22:/home/yasdb_home`  
-   `[::1]:/home/yasdb_home`  




1. 拆分多个ipv6地址。例如:


-   `[::[1-3]]`  
-   `[::[1-3]],[fe80::20c:29ff:fe75:582b%ens33]`  
-   `[::1],[fe80::20c:29ff:fe75:582b%ens33]`  
-   `[::1],[fe80::20c:29ff:fe75:[582b-582d]%ens33]`  




####   [5.1.3 散落在om中的ipv6判断](#513-散落在om中的ipv6判断)  

例如：



修改判断，使其为ipv6的情况下也继续运行。在其他修改完成后，再测试这些功能是否可以正常。

####   [5.1.4 yassh](#514-yassh)  

待修改后进一步测试。

####   [5.1.5 yasrpc](#515-yasrpc)  

大多数场景支持ipv6，无需修改。但是在registry场景下使用链路本地地址存在解析问题，等其他部分完成后再进一步分析。

./registry.go

```
parse "http://[fe80::20c:29ff:fe75:582b%ens33]:1234/_yasrpc_/registry": invalid URL escape "%en" 


```

####   [5.1.6 封装net.ParseIP函数以及修改netcli.GetIPAddrs函数](#516-封装netparseip函数以及修改netcligetipaddrs函数)  

ipv6场景下，使用net.ParseIP()处理的ip不能有中括号和网卡号，netcli.GetIPAddrs()返回的ip不具有中括号，而host配置文件的ip具有中括号和网卡号。所以增加一个判断并处理的过程。

####   [5.1.7 ":"切割字符串问题](#517-切割字符串问题)  

  `items := strings.Split(addr, ":")`     这种切割ip和端口的方式不兼容ipv6，会写一个函数代替。



####   [5.1.8 package config gen 本地安装](#518-package-config-gen-本地安装)  

通过--ip-type参数决定使用[::1]还是127.0.0.1作为本地ip地址。



####   [5.1.9 localhost判断](#519-localhost判断)  

这些地方的localhost默认为127.0.0.1，ipv6的情况下，应该为[::1]。



####   [5.1.10 CIDR处理](#5110-cidr处理)  

此处应该改为用逗号分隔多个子网掩码。后续流程和ipv6暂无冲突。



##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```
sudo ifconfig ens33 inet6 add fe80::20c:29ff:fe75:582c/64
sudo ifconfig ens33 inet6 add fe80::20c:29ff:fe75:582d/64
sudo ifconfig ens33 inet6 add ::2/64
sudo ifconfig ens33 inet6 add ::3/64
sudo ip addr add 127.0.0.2/24 dev ens33
sudo ip addr add 127.0.0.3/24 dev ens33
# se
../bin/yasboot package config gen -c se --host liushunpeng:lsp@[::1]:/opt -t de
../bin/yasboot package config gen -c se --host liushunpeng:lsp@[::1]:22 -t de
../bin/yasboot package config gen -c se --host liushunpeng:lsp@[::1]:22:/opt -t de
../bin/yasboot package config gen -c se --host liushunpeng:lsp@[fe80::20c:29ff:fe75:582b%ens33]:/opt -t de
../bin/yasboot package config gen -c se --host liushunpeng:lsp@[fe80::20c:29ff:fe75:582b%ens33]:22 -t de
../bin/yasboot package config gen -c se --host liushunpeng:lsp@[fe80::20c:29ff:fe75:582b%ens33]:22:/opt -t de

# de
../bin/yasboot package config gen -c de --host liushunpeng:lsp@[::[1-3]]:/opt -t de
../bin/yasboot package config gen -c de --host liushunpeng:lsp@[fe80::20c:29ff:fe75:[582b-582d]%ens33]:/opt -t de
../bin/yasboot package config gen -c de --host liushunpeng:lsp@[::1],[fe80::20c:29ff:fe75:582b%ens33]:22 -t de
../bin/yasboot package config gen -c de --host liushunpeng:lsp@[fe80::20c:29ff:fe75:[582b-582d]%ens33] -t de

# bad
../bin/yasboot package config gen -c de --host liushunpeng:lsp@127.0.0.1,[::[1-3]]:/opt -t de
../bin/yasboot package config gen -c de --host liushunpeng:lsp@[::[1-3]],127.0.0.1:/opt -t de
../bin/yasboot package config gen -c de --host liushunpeng:lsp@127.0.0.[1-3],[fe80::20c:29ff:fe75:[582b-582d]%ens33] -t de

```

./bin/yasboot package config gen -c fc --host liushunpeng:lsp@[::1],[fe80::20c:29ff:fe75:582b%ens33],[fc00:157::129]:    [22:/home/liushunpeng/yashandb2](http://22/home/liushunpeng/yashandb2)     -t de

cluster start/restart/stop

group start/restart/stop

package check gen

check collect -c de

数据导入命令

sql管理命令

备份恢复命令

  


  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

|序号|任务（AR）|优先级|关联AR|描述|工作量|责任人|状态|
|:---|:---|:---|:---|:---|:---|:---|:---|
|1|  
|  
|  
|  
|  
|  
|  
|
|2|  
|  
|  
|  
|  
|  
|  
|


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1. 支持数据库不同节点之间ip协议混用会导致om、yasagent的ip协议不同，目前暂不支持。
1.  check collect在没有集群名称参数、没有toml文件、异常情况下才会使用本地地址。先不处理。    

1. ![](https://pingcode.yasdb.com/atlas/files/public/67396a3ca1ad9a3311dc7bb5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFBSUFBQUFBQUFBQmdBQUFBQUFBZ0VBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIwMzUsImV4cCI6MTc4MjIyMjgzNX0.QlLSziQdX6HoqjZvvUwuv5hAKjaYRHUIe-HbXAfA7Yk)
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396a3c8970c2af4f51fd40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFBSUFBQUFBQUFBQmdBQUFBQUFBZ0VBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIwMzUsImV4cCI6MTc4MjIyMjgzNX0.QlLSziQdX6HoqjZvvUwuv5hAKjaYRHUIe-HbXAfA7Yk)


  


  


  


  


  


## Attachments:

## Comments:

|  [](null)  ,1. 对于    `[::ffff:127.0.0.1]`    这种IPv4映射IPv6地址，既支持在ipv6中使用，也支持在ipv4中使用。
,```
..<span class="hljs-regexp" style="color: rgb(188,96,96);">/bin/</span>yasboot <span class="hljs-keyword">package</span> config gen -c de --host <span class="hljs-string" style="color: rgb(136,0,0);">liushunpeng:</span>lsp@[::<span class="hljs-string" style="color: rgb(136,0,0);">ffff:</span><span class="hljs-number" style="color: rgb(136,0,0);">127.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.1</span>],[<span class="hljs-string" style="color: rgb(136,0,0);">fe80:</span>:<span class="hljs-number" style="color: rgb(136,0,0);">20</span><span class="hljs-string" style="color: rgb(136,0,0);">c:</span><span class="hljs-number" style="color: rgb(136,0,0);">29</span><span class="hljs-string" style="color: rgb(136,0,0);">ff:</span><span class="hljs-string" style="color: rgb(136,0,0);">fe75:</span>[<span class="hljs-number" style="color: rgb(136,0,0);">582</span>b<span class="hljs-number" style="color: rgb(136,0,0);">-582</span>d]%ens33] -t de
..<span class="hljs-regexp" style="color: rgb(188,96,96);">/bin/</span>yasboot <span class="hljs-keyword">package</span> config gen -c de --host <span class="hljs-string" style="color: rgb(136,0,0);">liushunpeng:</span>lsp@[::<span class="hljs-string" style="color: rgb(136,0,0);">ffff:</span><span class="hljs-number" style="color: rgb(136,0,0);">127.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.1</span>],<span class="hljs-number" style="color: rgb(136,0,0);">127.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.0</span><span class="hljs-number" style="color: rgb(136,0,0);">.2</span> -t de 
```,Posted by liushunpeng at 八月 31, 2023 11:55|
|---|

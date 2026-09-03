Created by 瞿蓝孟 on 七月 11, 2023

##   [1. Overview（概述）](#1-overview概述)  

主要是封装ycs的ycsctl工具，可以查看ycsctl status和ycsctl show config，仅共享集群可用

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持查看ycsctl status的结果
- 支持查看ycsctl show config的结果


##   [3. Interfaces（接口）](#3-interfaces接口)  

- yasboot ycs status
- 该命令用于查看ycs的状态信息
- yasboot ycs show
- 该命令用于查看ycs的配置信息


|参数|选项|说明|
|---|---|---|
|-c,--cluster|必填|共享集群的名称|
|-n,--node-id|必填|共享集群的节点id|


|参数|选项|说明|
|---|---|---|
|-c,--cluster|必填|共享集群的名称|
|-n,--node-id|必填|共享集群的节点id|


##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

####   [](#)  

目前ycsctl工具支持命令查看ycs节点的状态，命令为：ycsctl status

```
[jenkins@localhost 23.1.0.2]$ ycsctl status 
---------------------------------------------------------------------------------------------
age    |self node id|cluster master id|yasfs master id|yasdb master id|active node count
---------------------------------------------------------------------------------------------
0       0            0                 0               0               1         
---------------------------------------------------------------------------------------------
Node      |Target    |State     |YasFS     |YasDB     |YasDB inter url
---------------------------------------------------------------------------------------------
0          online     online     online     online     192.168.4.110:1689
1          offline    offline    offline    offline               
2          offline    offline    offline    offline               
3          offline    offline    offline    offline 

```

om封装后，命令为“yasboot ycs status”：

```
[jenkins@localhost work]$ ./bin/yasboot ycs status  -c tt -n 1-1
---------------------------------------------------------------------------------------------
age    |self node id|cluster master id|yasfs master id|yasdb master id|active node count
---------------------------------------------------------------------------------------------
0       0            0                 0               0               1         
---------------------------------------------------------------------------------------------
Node      |Target    |State     |YasFS     |YasDB     |YasDB inter url
---------------------------------------------------------------------------------------------
0          online     online     online     online     192.168.4.110:1689
1          offline    offline    offline    offline               
2          offline    offline    offline    offline               
3          offline    offline    offline    offline               



```

目前ycsctl工具支持命令查看ycs节点的配置，命令为：ycsctl show config

```
[jenkins@localhost 23.1.0.2]$ ycsctl show config
    Cluster name: yasdb_tt123, config version: 2
    Default resource yasfs: enabled
    Shell in cluster:
      Start shell:   start.sh
      Stop shell:    stop.sh
      Monitor shell: monitor.sh
    Nodes in cluster:
      Node name: yas1, yascs/yasfs inter connect URL: 

```

om封装后，命令为“yasboot ycs show”：

```
[jenkins@localhost work]$ ./bin/yasboot ycs show  -c tt -n 1-1
    Cluster name: yasdb_tt123, config version: 2
    Default resource yasfs: enabled
    Shell in cluster:
      Start shell:   start.sh
      Stop shell:    stop.sh
      Monitor shell: monitor.sh
    Nodes in cluster:
      Node name: yas1, yascs/yasfs inter connect URL: 192.168.4.110:1788, Node ID: 0
        yasdb instance name:yasdb, yasdb instace id:0


```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*
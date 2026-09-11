Created by 瞿蓝孟, last modified on 十一月 13, 2023

##   [1. Overview（概述）](#1-overview概述)  

23.1版本，通过yasboot部署共享集群，节点数量限制最大为4。

现在需要放开这个限制，支持8节点的共享集群部署。

##   [2. Features（功能特性）](#2-features功能特性)  

- yasboot支持8节点共享集群的安装部署
- 节点数量最大允许为64


##   [3. Interfaces（接口）](#3-interfaces接口)  

yasboot命令无变化，只是内部的限制条件放开了

- yasboot package ce gen：生成共享集群的配置文件
- yasboot package install：安装yasom，yasagent
- yasboot cluster deploy：部署共享集群


详细部署使用方法可以参考：文档中心“安装和升级-安装部署-YashanDB命令行安装-共享集群部署”

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

节点数量最大限制为64，只是理论预留的节点规格，该SR只用验证8节点的安装部署

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

无详细设计

om去掉生成配置文件时，最大节点数量为4的限制；

db创建实例时，去掉数量最大为4的限制；

ycs去掉最大数量为4的限制；

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*
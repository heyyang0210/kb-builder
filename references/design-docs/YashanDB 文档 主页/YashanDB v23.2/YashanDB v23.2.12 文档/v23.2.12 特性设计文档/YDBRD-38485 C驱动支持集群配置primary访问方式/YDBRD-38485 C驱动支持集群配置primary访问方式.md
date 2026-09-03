  [https://pingcode.yasdb.com/pjm/items/67bec47c6dccc3daa312dd60?](https://pingcode.yasdb.com/pjm/items/67bec47c6dccc3daa312dd60?)  

#YDBRD-38485 C驱动支持集群配置primary访问方式



## 1. 总述

当前集群不支持配置primay方式使用，导致在主备集群场景下，C驱动使用复杂性增加；故需要支持集群配置primary的访问方式。

### 1.1 需求来源

  适配对齐JDBC的高可用连接能力。

### 1.2 调研文档

  无

### 1.3 需求分析

1. standby支持多IP配置
1. loadbalance+primary+failover组合方式访问
1. loadbalance+primary组合方式访问


### 1.4 数据字典

无

### 1.5 开源依赖

 无

## 2. 接口

无

## 3. 规格与约束

无

## 4. 特性

### 4.1 支持关键字:

1.  standby(只连接备机)。
1. standbyLoadBalance(只连接备机，并且支持负载均衡)。
1. primaryLoadBalance(只连接主机，并且支持负载均衡)。
1. 链接参数包括yasc_service.ini中同样支持链接参数关键字。


关键字忽略大小写

### 4.2 支持关键字模式连接:

1.  standby：对应primary模式，只接链接备机，不是备机则访问下一个ip。
1. standbyLoadBalance：对应loadBalance模式，只接链接备机，不是备机则不计算负载，最后再取负载最小的备机进行连接。
1. primaryLoadBalance：对应loadBalance模式，只接链接主机，不是主机则不计算负载，最后再取负载最小的主机进行连接。
1. 判断主备sql，新增适配status open状态的判断。


```
SELECT DECODE(ROLE,'PRIMARY',1,0) FROM DATABASE_ROLE
SELECT DECODE(ROLE,'PRIMARY',1,0) FROM DATABASE_ROLE WHERE STATUS IS NULL OR STATUS = 'OPEN'
```

### 4.2 TAF支持:

1. standby：TAF过程中，对应primary模式，只接链接备机，不是备机则访问下一个ip，顺序访问，知道访问全部ip以后，如果没有可链接的备机，则连接失败。
1. standbyLoadBalance：TAF过程中对应loadBalance模式，只接链接备机，不是备机则不计算负载，随机从任何一个节点开始访问，最后再取负载最小的备机进行连接，确保负载均衡。
1. primaryLoadBalance：TAF过程中对应loadBalance模式，只接链接主机，不是主机则不计算负载，随机从任何一个节点开始访问，最后再取负载最小的主机进行连接，确保负载均衡。


## 5. Testcases（自测用例）

1. 测试三种连接模式，在单机，分布式，集群中都能够正常的连接。
1. 负载均衡中能够连接到负载最小的一个。
1. TAF过程中同样能够正常转移，并且按照不同的模式实现转移。
1. 多并发测试负载是否均衡。
1. yasc_service.ini同样支持三种连接参数。


## 7. 工作量评估

7人天

## 8.资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

## 9.未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。
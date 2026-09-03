Created by 龙忠友, last modified by  李佐龙 on 十一月 22, 2023

## 1. Overview（概述）

GRC采用基于资源ID的一致性哈希算法，将元数据分布到所有节点上。实例加入和离开集群都会导致资源重分布，采用一致性哈希的好处是避免全局资源在各个在线实例内部的搬迁。GRC资源的重分布依赖整个reform过程。

-    发生条件：reform时，ReformMaster.needRemaster是true
-    发生阶段：REFORM_PHASE_FREEZE， 即是在latch exclusive内进行。grc资源重分布和恢复之后reform的阶段变为REFORM_PHASE_UNFREEZE。


## 2. Features（功能特性）

     当有实例异常退出后，master实例发起grc资源重分布，将退出实例的grc资源分布到在线的实例上。

## 3. Interfaces（接口）

可以通过动态视图查看dht rule的分布情况：

- V$GRC_DHTRULE


## 4. Limitations（功能限制）

  


## 5. Detail Design（详细设计）

## 5.1.  dhtRule的分布

    GRC资源按照hash值分布在不同实例上，hash值范围为[0,256) 整数值，每个实例存在4个虚拟节点，当前虚拟节点到下一个虚拟节点的范围属于当前实例管理的GRC hash值范围，实例加入会将最近一个管理大范围hash值均分，  **实例退出会将hash值合并与前一个实例管理**  。

    当集群只有实例0时

-     实例0管理的hash值范围为  [0, 64), [64, 128), [128, 192), [192, 256)。


    当实例1启动后，会把实例0的范围均分，结果为

-     实例0管理的hash值范围为[0, 32),       [64, 96),     [128, 160),    [192, 224)
-     实例1管理的hash值范围为[32, 64),     [96, 128),   [160, 192),    [224, 256)。


     当实例2启动后，会把实例1的范围均分，结果为

-     实例0管理的hash值范围为[0, 32),       [64, 96),         [128, 160),    [192, 224)
-     实例1管理的hash值范围为[32, 48),     [96, 112),       [160, 176),    [224, 240)。
-     实例2管理的hash值范围为[48, 64),     [112, 128),     [176, 192),    [240, 256)。


### 5.1.1. 三实例下，实例2退出后dhtRule分布

把原来实例2管理的dht rule分布合并到实例1上。

-     实例0管理的hash值范围为[0, 32),       [64, 96),     [128, 160),    [192, 224)
-     实例1管理的hash值范围为[32, 64),     [96, 128),   [160, 192),    [224, 256)。


### 5.1.2. 三实例下，实例1退出  后dhtRule分布

把原来实例1管理的dht rule分布合并到实例0

-     实例0管理的hash值范围为[0, 48),       [64, 112),       [128, 176),    [192, 240)
-     实例2管理的hash值范围为[48, 64),     [112, 128),     [176, 192),    [240, 256)。


### 5.1.3. 三实例下，实例0退出  后dhtRule分布

把原来实例0管理的dht rule分布合并到实例2

-     实例1管理的hash值范围为[32, 48),     [96, 112),       [160, 176),    [224, 240)。
-     实例2管理的hash值范围为[48, 96),     [112, 160),     [176, 224),    [240, 256)，[0, 32)。


## 5.2. GRC资源迁移

- 当实例异常退出时，会计算出新的dhtrule，然后根据旧的dhtrule和新的dhtrule，计算出每个hash值对应的srcInst和dstInst。初始化hash对应的blockArea和nonBlockArea内存。对应的master信息，由后续的资源恢复来构建。
- 当实例正常退出时，会计算出新的dhtrule，然后根据旧的dhtrule和新的dhtrule，计算出每个hash值对应的srcInst和dstInst。由srcInst往dstInst进行parts迁移。


## 6. Testcases（用例）

## 7. Workload（工作量）

1. 评估代码量KLOC = xxx行
1. 评估工作量 =xxx（人天）


## 8. TODO（遗留问题）

  




  


## Attachments:

[remaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGI4OTcwYzJhZjRmNTIwMzZhIiwicmVmX2lkIjoiNjczOTZiNGI1OTNmOTljOWZmMjM2MDg0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNzA3LCJleHAiOjE3ODIzNzkxMDd9.4jrhE1e3HHzfAqrISj15mfzlnOQ824C5DTJtgD67CYw)

 (image/png)    


[image2023-7-13_20-9-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGJhMWFkOWEzMzExZGM4MWUwIiwicmVmX2lkIjoiNjczOTZiNGI1OTNmOTljOWZmMjM2MDg0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNzA3LCJleHAiOjE3ODIzNzkxMDd9.VL9jaE7f9trJ8wnDPunUrQDgDxVkindF3kuVkwHeur8)

 (image/png)    


[image2023-7-13_20-9-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGI4OTcwYzJhZjRmNTIwMzZiIiwicmVmX2lkIjoiNjczOTZiNGI1OTNmOTljOWZmMjM2MDg0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNzA3LCJleHAiOjE3ODIzNzkxMDd9.-Vc5yn_0tG88VNS4y66p6ezcfnYchvDrP6DYS1-ugfo)

 (image/png)    

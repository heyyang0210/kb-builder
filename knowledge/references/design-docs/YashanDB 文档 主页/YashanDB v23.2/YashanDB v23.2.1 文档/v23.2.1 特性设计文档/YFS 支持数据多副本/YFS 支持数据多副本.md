Created by 马勇, last modified by  吕雷奇 on 一月 17, 2024

## 1. Overview（概述）

1.   yfs 支持用户数据多副本校验

将业务层数据校验下沉到 YFS 层实现。

调研发现 DB 业务层的校验函数包含一些非数据完整性校验，如数据的业务有效性检查、解析等。

YFS 仅承接数据完整性校验，因为业务无效的数据无法通过切换副本解决。

## 2. Features（功能特性）

- 当 DB 在 normal 和 high 冗余度的 DG 保存数据，部分副本数据损坏时，业务不感知。   

## 3. Interfaces（接口）

1. v$yfs_file 查看文件类型。


## 4. Limitations（功能限制）

  


## 5. Detail Design（详细设计）

### 5.1 记录文件类型

Oracle ASM 通过系统表记录所有文件类型，分析认为其  自动通过记录的文件类型解决多副本校验策略。

![](https://pingcode.yasdb.com/atlas/files/public/67396c59a1ad9a3311dc89cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

YFS 相比 ASM 做了极大简化，因此需直接在 file ctrl 中记录文件类型 type。文件 type 通过       `yfsiCreateFile`       接口，由 DB 传入。

上层应用（DB）至少应保证：

1. 调用       `yfsiCreateFile`       时都知道文件类型。
1. 调用       `yfsiWrite`       时的数据都包含完整的校验信息。
1. 调用    `yfsiRead`       时的 offset 和 size 内的数据都是完整的可校验数据。


### 5.2 业务数据多副本

![](https://pingcode.yasdb.com/atlas/files/public/67396c598970c2af4f520b62/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

YFS 的多副本校验发生在 IO 时，可能发起 IO 的组件：

- YFS service，主要读写元数据；
- 客户端，如 DB、YFSCMD。


目前 YFS 仅支持 YFS 元数据冗余，即 YFS 内部数据类型已知，由 YFS 自行安排这些数据的校验。

![](https://pingcode.yasdb.com/atlas/files/public/67396c598970c2af4f520b63/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

DB 对 YFS 的 IO 都是直接 IO，因此多副本校验在 API 内执行。 DB 数据的校验方法由 DB 通过接口自行指定。

  


  


>   问题：    同一数据由不同客户端访问，数据的可信度不一致。例如 YFSCMD 无法获悉 YFS 中数据来源，也就无法自行注册适当的校验函数。这可能使得 YFSCMD 在数据异常时变得脆弱，无法获得正确的副本数据。    另外编写校验函数也变得困难，需要考虑向前兼容，跨版本文件甚至可能无法从 YFS 中读出。如 YFSCMD 需支持多副本，则应集成 DB 的校验函数。  

```

```

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c59a1ad9a3311dc89d0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

由于某些业务目前无法直接在 YFS 内校验数据，YFS 开放低级接口，便于业务层明确指定数据副本编号。

此类情况的主要原因是，有些情况需多次 IO 才能读到足以校验的数据长度。这种情况应尽可能消除，避免上层业务感知多副本，引入不必要的复杂度。

### 5.3 副本校验方法

![](https://pingcode.yasdb.com/atlas/files/public/67396c598970c2af4f520b64/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

  


图示为 2 副本，同一 partner 的一对 AU 互为副本，它们的数据完全一样，只要它们至少有 1 个数据完整，就不会丢失数据。图中绘制了一些 AU，它们共同构成了文件的一段连续区域。

图中用红色标记了损坏的数据，理论上只要每一对副本中至少有一个完整数据，就可以拼出文件数据，即使各副本中存在大量损坏的数据，通过图中的路径依然可以获得完整的文件数据。

数据的完整性由业务校验，一般需要数据达到特定长度才能计算checksum（比如总长 8M）。对于由多组 AU 组成的数据，一旦某些 AU 损坏，YFS 不知道到底那些 AU 损坏了，那么就需要校验这些 AU 的全部组合，直到找到图中的路径，拼出完整数据。例如图中共有 2这会显著的引入的复杂度和性能问题。

因此 YFS 采用一种简化方案。

![](https://pingcode.yasdb.com/atlas/files/public/67396c59a1ad9a3311dc89d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

全部 AU 伙伴的第 1 个 AU 构成文件的第 1 个副本，全部 AU 伙伴的第 2 个 AU 构成文件的第 2 个副本，以此类推。

如果副本 1 中任意 AU 损坏，该副本校验失败，应尝试校验后续副本，找到完整的数据。

这简化了副本校验复杂度。

### 5.4 不定长数据的校验

#### 5.4.1 block 不大于 IO buffer

![](https://pingcode.yasdb.com/atlas/files/public/67396c59a1ad9a3311dc89d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

当读入特定长度的数据，但只有其中一部分数据受 checksum 保护，无法校验的那部分数实际上无法确认其完整性。无法校验的数据应抛弃。

被抛弃的数据可能在下次读取时，从头读到完整且被保护的数据。

但这会使得业务很难判断读取数据长度不足的原因，是有部分数据损坏，还是文件长度不足（由于无法对文件加锁，因此 read 返回后再判断长度不可靠）。

#### 5.4.2 block 大于 IO buffer

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c59a1ad9a3311dc89d3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

~~block 有可能由 2 次 IO 组成，DB 可能使这 2 次 IO 分布在不同的线程，甚至远程服务上。需要业务层主动切换副本，发起重读。~~

~~redo、恢复文件等存在切片，即为上图所属情形。~~

对 redo 文件切片可能截断 pack，造成 redo 无法校验，redo 文件在备份时暂不支持多副本校验，但回放业务中可以校验。

数据文件、ctrl 等文件的切片不会截断内部 block，可能 buffer 中包含多个 block，校验函数会逐一校验所有 block，任一 block 不完整，则切换副本。

### 5.5 修复损坏副本

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c59a1ad9a3311dc89d4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

YFS 的副本修复在 Read 时同步实现，在 Read 时发现校验失败的副本，只要可以从其他副本读到完整的数据，YFS 会立刻将完整数据写入损坏副本位置，尝试修复。

本迭代暂不考虑磁盘坏块修复，认为损坏副本写入后即恢复。

【修复时打印 INFO 日志】

[YFS] repair dg:%u, fd:%u, offset:%lu, len:%u, copyIndex:%u

  


### 5.6 兼容性

YFS 内部也使用文件管理自身元数据，这些文件即 “元文件（Meta Files）”。前一迭代 YFS 客户端实际上不具备业务数据多副本能力，YFS 服务端单独实现了元文件的校验逻辑。

考虑统一所有文件：

- 元文件
- 普通用户文件
- 无副本文件


的校验，因此元文件会预留一些文件类型。

YFS 文件类型为       `UINT8`       数据，共计 255 种文件类型。将其做如下规划：

![](https://pingcode.yasdb.com/atlas/files/public/67396c5a8970c2af4f520b65/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

- 类型 0，预留，不校验。兼容早期版本。
- 类型 255，预留，无效文件。
- 类型 200~254， 系统预留，用于表示元文件。
- 类型 1~199 用户自定义文件类型。


用户自定义文件类型必须从 1 开始。

### 5.6 DB 文件调研

YFS 应支持校验的文件类型：

- [x]    redo/arch（备份读取时不支持多副本，回放时支持）   

- [x]  数据文件    
   

- [x] system   

- [x] sysaux   

- [x] users   

- [x] undo   

- [x] temp   

- [ ] ~~swap，~~  不支持   

- [x]    ctrl   

- [ ]    ~~备份文件~~   

- [ ]    ~~back file list~~   

- [ ]    ~~profile file （无校验，不支持多副本）~~   

  


#### 5.6.1 常规文件

没有压缩、加密，定长的数据校验。

以下文件都具备定长 block。

- ctrl
- 表空间
- back list
- profile file


按定长 block 校验即可。

#### 5.6.1  redo/arch file

![](https://pingcode.yasdb.com/atlas/files/public/67396c5aa1ad9a3311dc89d5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

先读取 file header，再读取 block，从头按 block 校验，不足 block 的数据忽略，仅按 block 计算 readSize。

抽取业务逻辑中的 block validate 逻辑，委托 YFS 执行。

![](https://pingcode.yasdb.com/atlas/files/public/67396c5a8970c2af4f520b66/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

但这样对现有业务调整较大，考虑由业务自行切换副本。

#### 5.6.2 备份文件

备份对象包括：

- 数据文件
- ctrl
- redo
- 备份 profile


等子类型，备份文件内部子类型较多，目前无法统一处理。

这些数据会被切片、压缩、加密、变长，不考虑数据切片引起的 “不完整” 数据问题，备份数据结构存在以下可能：

![](https://pingcode.yasdb.com/atlas/files/public/67396c5a8970c2af4f520b67/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

其中：

- 未加密、压缩文件：数据保持源数据格式，校验方法需知道备份源数据类型。考虑到切片位置不确定，这类数据可能无法在 YFS 校验。
- 加密或压缩数据：数据包含   BakBlockHeader 头，其中 checksum 保护 BakBlockHeader，未保护数据。


由于未加密、未压缩数据不一定存在 Header，没有额外参数则无法确定如何解析 buffer 头。

校验方法：

1. 备份文件写入时，如无加密、压缩，则为数据增加 BakBlockHeader。如此所有备份数据块结构统一，无需关注备份文件源数据类型。
1. BakBlockHeader 新增 blockChecksum 字段，用于保护数据区域。由于目前不支持跨版本恢复，因此暂不考虑兼容性问题。


调整后备份文件 block 看起来如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c5a8970c2af4f520b68/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

如此备份文件在 IO 时可以对所有 back block 无差别校验。

考虑额外提供配置参数，用于关闭恢复时的多副本，在必要时获得较高的恢复效率。

  


恢复文件按 buffer size 读，由于 bakBlock 是变长的，那些不足 1 个 bakBlock 的部分由于没有经过校验，业务层会丢弃，重新从下一个 bakBlock 头开始读。

伪代码如下：

```
offset = 0;
bufferSize = BUFFER_SIZE
while backFile.readBuffer(offset, buffer, bufferSize):
    for bakBlock in buffer.bakBlocks:
        if validate(bakBlock) == failed:
            tryNextCopy or return failed
        offset += bakBlock.size
    bufferSize = min(BUFFER_SIZE, remainSize)
```

  


### 5.7 DFX 设计

### 5.7.1 YFS IO 合并

支持最长 128 个 AU 合并。如超出则不合并任何 IO 请求，业务对是否执行 IO 合并不感知。

## 6. Testcases（用例）

  


|测试场景|预期|
|---|---|
|YFS 基本功能|文件创建、删除、扩展缩小、IO 等基本功能正常。本迭代对 YFS IO 相关的代码调整较多，需加强测试基本功能。|
|破坏 data file 副本|所有副本破坏，DB 报错。,否则，DB 正常。|
|破坏 redo file|所有副本破坏，DB 恢复时报错。,否则，DB 正常。|
|破坏 ctrl file|所有副本破坏，DB 启动时报错。,否则，DB 正常。|
|损坏副本修复|破坏数据副本后，读 1 次，被破坏数据恢复。|
|备份和恢复|特别是 rman 备份恢复|
|兼容性|23.1 初始化的 DB，更换 23.2 软件包后，可以正常工作|


**注意**  ：

1.Yashan 的 checksum 校验函数，对 checksum = 0 的场景不做校验，全零数据会被当作正常数据加载，破坏数据时不要用 /dev/zero 作为数据源，尽量使用 /dev/urandom。

这个问题可能在实现时根据修复。

2.YFS 统计功能有调整，服务端、客户端 IO 均被计入，注意测试。

### 6.1 如何破坏副本

该项目可以方便的破坏文件指定副本：    [https://git.yasdb.com/mayong/yfs_debug_tools](https://git.yasdb.com/mayong/yfs_debug_tools)  

下面为手动操作，效果相同。

#### 6.1.1   精确破坏文件副本

1.  找到文件 fd


```
export YASFS_HOME=xxx
# -g group_id 
# -f fd
yfsminer -g 0 -f 3
```

通过上述指令查看 DG id 0 的 3 号元文件，也就是 dir 目录树，找到目标文件的 fd。

![](https://pingcode.yasdb.com/atlas/files/public/67396c5aa1ad9a3311dc89d6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

例如 redo2_3 文件 fd 为 267.

```
# -f fd
# -b block_id
yfsminer -g 0 -f 1 -b 267
```

查看 1 号元文件的 267 号块，也就是 267 号文件的元数据。

![](https://pingcode.yasdb.com/atlas/files/public/67396c5a8970c2af4f520b69/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQVFBQUlBREFBZ0FBRkFBQUFnQUFBQUFBRUFBUUFJb0FCQUFBQUFBQUFKaEFBQUFBWUFBQUNBQUNBQUFBQUFBZ0VRQklBQ2dBQUFJQkFBZ0FKQUFBQUVBQkFBQUVFZ0FBQUF3QUFDQW9BZ0FBZ2dBRUNRQUFBQUFBQkJBQ0FDQUFBQUFFUUFBQ0FJQUFJQUVFSUJBUWhDQ0FBRUFBQUFBQUFBQUlDSklBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzODEsImV4cCI6MTc4MjMxMTE4MX0.O5ltG1MDDWWDx_vqZVwILkKR-IX1oFaZH7V_Xnhn4Hc)

可以看到组成文件的 AU 所在位置，如为 2 副本，那么每 2 个 AU 互为副本，以此类推。

向 AU，也就是指定磁盘的指定位置，写入不超过 1 个 AU 的随机数据即可。

  


#### 6.1.2   破坏所有副本

目前 yfs 还不支持 disk 元数据副本，因此磁盘前 3 个 AU 不能被擦除。

从第 4 个 AU 开始，可以用 dd 工具用随机数擦除。

##   [7. 资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

新增错误码   ERR_YFS_VERIFY_FILE， 报错提示 DG id， fd， offset 和 长度。

## 8. TODO（遗留问题）

1. 服务端无法识别异常副本，修复只能放到客户端处理。
1. 部分业务数据目前不具备直接校验数据的能力，数据块中没有 checksum。(无压缩无加密的备份数据，新方案中会增加校验信息)
1. 恢复数据可能有并发读、解压，超过 IO buffer 的超长数据，如能分别校验最好，可以将副本切换逻辑在 1 个 读 操作内实现，避免 DB 调用底层接口，主动切换，引入不必要的复杂性。（备份文件按 IO block 校验。）


  


其他事项：

1. 统一客户端和服务端 IO 相关代码。


  


## Attachments:

[image2023-10-17_16-23-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTdhMWFkOWEzMzExZGM4OWMwIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.jUDB81_ydtTSTUDPvHVbDAz95sqniZghHDmdunrMTpI)

 (image/png)    


[image2023-10-17_16-4-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTdhMWFkOWEzMzExZGM4OWMxIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.ObuCz0XqDe_wjO3_qcSFlT3JKRfEnLu7_pcPGGlGBVs)

 (image/png)    


[image2023-10-17_14-31-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTc4OTcwYzJhZjRmNTIwYjUxIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.zg1z8xnujGq_eGqyNAIL27ycfs5NTIogTkW_Vy_pRls)

 (image/png)    


[image2023-10-17_14-27-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTc4OTcwYzJhZjRmNTIwYjUyIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.DSEGnTNDE74KjID4PuRjAPw3PN_sCOKHJgEmrawcG9w)

 (image/png)    


[image2023-10-17_11-56-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTg4OTcwYzJhZjRmNTIwYjUzIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.EtukU4yUqiBK6En_949AGmdDzEkRBZ8qNsrFcginQTo)

 (image/png)    


[image2023-10-19_18-21-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTg4OTcwYzJhZjRmNTIwYjU2IiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.cSpABQ4RXrZeueu9pr0Cg91-h07TXCj-3iPRlgTDC5o)

 (image/png)    


[image2023-10-19_18-21-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTg4OTcwYzJhZjRmNTIwYjU3IiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.Ac2-N_opzdDpc9Hhqp44-hOd3_WqSQ3F6Q5ygplzT_Q)

 (image/png)    


[image2023-10-19_18-24-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTg4OTcwYzJhZjRmNTIwYjU4IiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.9Mlg7nHUsxuRwj8zB9Fhb2tWT6xqJKbVpmuOSWRfLzc)

 (image/png)    


[image2023-10-19_18-26-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNThhMWFkOWEzMzExZGM4OWM3IiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.55NRXYM2bpz-UNCT3AKcUU5T5Gv7Fq_VXN3wUyeckTI)

 (image/png)    


[image2023-10-19_18-32-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTg4OTcwYzJhZjRmNTIwYjVhIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.RyaWyuDQJOSLXnyfManYt5CRirko7WB_mY6OwGyzOnY)

 (image/png)    


[image2023-10-19_18-32-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTg4OTcwYzJhZjRmNTIwYjViIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.9-MhonN4gpEO-bITDwPTM3VNdiYBkoakOgjmoU8F3iI)

 (image/png)    


[image2023-10-23_11-4-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNThhMWFkOWEzMzExZGM4OWM5IiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.jj4Dc0ghTbwgdmnSGSZSrUYdodWHfhXljmp4jEAJ3_o)

 (image/png)    


[image2023-10-23_16-0-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTlhMWFkOWEzMzExZGM4OWNjIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.iRBavhrKUDCmTqNOV5OR-aMs2kYlK-DNHX2nfsMhoBI)

 (image/png)    


[image2023-10-24_16-2-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTlhMWFkOWEzMzExZGM4OWNkIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.NKvARLafd_VOi8qSj47iFMUSlt3hGQKfP7fKZ6Tk7WE)

 (image/png)    


[image2023-10-30_15-54-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTlhMWFkOWEzMzExZGM4OWNlIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.12VqmQ9bSmSaS45D0swNwmCfN7ihPGAXJD_8KVvdtQM)

 (image/png)    


[image2023-11-10_18-29-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTk4OTcwYzJhZjRmNTIwYjYwIiwicmVmX2lkIjoiNjczOTZjNTc1OTNmOTljOWZmMjM2ZGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzgxLCJleHAiOjE3ODIzODY3ODF9.32wucjyOGRSalFOUjoimTxgKQgdGyrMgWow0UO8cL7I)

 (image/png)    

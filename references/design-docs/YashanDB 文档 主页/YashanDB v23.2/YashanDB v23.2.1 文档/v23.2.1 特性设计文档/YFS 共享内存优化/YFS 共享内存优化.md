Created by 马勇, last modified on 一月 04, 2024

## 1. Overview（概述）

优化目标：

- 优化共享内存占用
- 异常退出共享内存残留
- 解决共享内存配置参数难以确定合理值的问题


## 2. Features（功能特性）

- 简化 YFS 配置，调整 SHM_POOL_SIZE、SYS_AREA_SIZE 配置语义，调整为上限值，内存均采用实时分配，不再预占。
- 系统内存耗尽，或达到配置上限，报无法分配内存。
- YFS 异常退出时，无需手动清理共享内存。
- YFS 运行时共享内存占用量降低。
- 通过 yfscmd 查看 YFS shm 使用情况。


## 3. Interfaces（接口）

1. yfscmd 新增 show status 查看共享内存、sys area 占用。
1. yfscmd 在线更新配置
1. 异常重启 YFS，自动清理残留共享内存。


## 4. Limitations（功能限制）

  


## 5. Detail Design（详细设计）

### 5.1 共享内存池

![](https://pingcode.yasdb.com/atlas/files/public/67396c548970c2af4f520b3c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

- 所有 dg 共享 shm pool。
- shm pool 由服务端管理，客户端只读。
- yfs service 在本地文件系统中，维护一个文件，其中保存了已创建的共享内存信息：id;id;id，用于 yfs 非正常退出后，重启释放旧 shm。
- client 与 server 之间仅需传递 area id 和 offset，client 将其转换为内存地址。
- 客户端连接时，获得 area 0 的 key 和 id，其他 area 信息由 area 0 链式获得。


**注意：**

在 instance/shm.id 中记录 YFS 打开的所有共享内存对象，测试中应检查 YFS 占用的 shm id 与该文件记录是否一致。shm.id 文件为二进制，请使用 yfsminer 解析。

![](https://conf.yasdb.com/download/attachments/135613448/image2023-11-22_16-52-41.png?version=1&modificationDate=1700643161000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

内存池布局，修改为多 area。

- 通过创建更多的 area，为 shm pool 扩容，新增的 area 信息写入本地文件，异常重启时释放。
- yfs server 负责 shm 的管理，在 server 私有内存中通过 free list 管理释放的内存，目前暂不支持碎片内存释放，仅支持释放 au size 大小的内存。free list 中的空闲 block 可能位于不同的 area，它们通过单向链表管理。


![](https://pingcode.yasdb.com/atlas/files/public/67396c548970c2af4f520b3d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

YfsShmChunk 结构调整如图，增加 area id。area id 从 0 开始，仅通过 YfsShmChunk 即可获知内存所在 area id 和其在 area 上的 offse。

![](https://pingcode.yasdb.com/atlas/files/public/67396c54a1ad9a3311dc89aa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

图中 cached area 为 DynamicArray，是连续内存的可扩展数组。

由于 cached area 在所有 chunk 到 ptr 的转换处都会用到，调用非常频繁，ObjArray 内部实现可能有不连续的情况，无法直接寻址，因此应使用 DynamicArray。

只有 YFS 服务有 shm 的管理的义务，因此 YfsShmPool 是 YFS 服务端的私有对象。客户端仅凭 YfsShmChunk 和缓存的 area list 即可访问共享内存。

除 area 0 外，其他各 area 由 area 0 的 nextInfo 链式获得。

area 的 size 考虑变长策略，由于绝大多数情况下 shmPool 的内存都是以 AU size 分配，除 area.header 信息外，Area 至少应为最大 auSize 的 2^N 倍。

area 0 的初始大小估计：

- area.header等占据 1 auSize；
- 全局 dg 信息 至少1 auSize；
- 1 个 auSize 大小的 hashmap；
- 平均 1 个文件预留 2 个 auSize 的 shm；
- 按一般需创建 256 个文件计。


估计 area 0  的大小 = (1 + 1 + 1 + 2 * 256 ) * auSize，按最小 auSize = 1M 计算，向下取整（因为文件消耗 shm 的大小计算比较宽裕），area 0 的大小 = 512M。

area 0 的 size 决定了 YfsShmChunk 的 64 bit 中，area id 和 offset 的占比。

如 area0 size = 512M，如最大 are size 为 4G，offset 需占据 32 bit，area id 可占据 32 bit。如 area 0 size 变化，YfsShmChunk 中 offset 和 area id 占比会发生变化。 

area 0 size 在编码时确定。

![](https://pingcode.yasdb.com/atlas/files/public/67396c548970c2af4f520b3e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

各 area 的 size 按 area 0 的倍数计算，例如  [1， 2，4，8，8 ...]，area size 达到某个上限不再增长。 

如用户配置 shm 空间上限，达到上限后不再扩展。

如果某个 area 申请失败，那么会按 area0 大小重试，降级处理。

**YfsShmChunk 到 地址的转换过程**  ：

![](https://pingcode.yasdb.com/atlas/files/public/67396c54a1ad9a3311dc89ab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

客户端和服务端都缓存了 shm info 到 地址的映射，当发现未缓存的 area id 时，则从已知 area 开始遍历 nextInfo，即可 attach 新的 area。

1. 从 YfsShmChunk 中提取 area id；
1. 在本地 cache 中查找 area id 的基址；
1. 如 cache 中不存在，说明服务端创建了新的 area，遍历已知 area 并 attach 新 area，加入 cache；
1. 从 YfsShmChunk 中提取 offset；
1. 与 area 基址相加达到 shm addr。


  


**局限性：**

共享内存的 area id 不能在运行时改变，那么 shm pool 中 area 不能在运行时释放。

### 5.2 freeList 细节

![](https://pingcode.yasdb.com/atlas/files/public/67396c548970c2af4f520b3f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

![](https://pingcode.yasdb.com/atlas/files/public/67396c548970c2af4f520b40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

freeList 是 server 端私有信息，其中记录了被回收的 shm blocks，由于 shm pool 是全局的，所有 dg 都可能从中申请， 因此 freeList 需按 YFS 支持的所有 au size 分别准备 free 链表，记录那些回收的 indirect au cache block。

### 5.3 共享内存残留

shmpool 创建 area 时，在 instanc/shm.id  中记录 shm id，用于异常重启时清理 shm。

![](https://conf.yasdb.com/download/attachments/135613448/image2023-11-22_17-0-19.png?version=1&modificationDate=1700643619000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

yfs service 启动时，检查本地文件中是否有 shm 记录，如有则先释放残留的 shm，再创建 shm。

该文件为二进制，格式：

![](https://pingcode.yasdb.com/atlas/files/public/67396c54a1ad9a3311dc89ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUNFQUVJQUFBQUFBQUFBQ0FBQUFCQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUVBZ0FBQUFBQUFBQUFBUUFBQUFBRUFBQ0FBQUFBQUVBQUFBQUFBQUFBQUlBQUFBS2dBQUNCQUFBQUFDRUJBQ0FBQUFBQUNBQUlBQUFFSUFRQ0FCQUFBQUFBQUNBQUFBQUNBQUFBQUFBQUFBVmdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzNDYsImV4cCI6MTc4MjMxMTE0Nn0.IZkJKbdPnm5W1aRUJ4emNN51lr2gqJpUxbM-kY_v8sQ)

如文件损坏则记录日志，提示用户手动清理，不自动清理。

### 5.4 hashmap（后续需求解决）

规定同时打开文件数量（含元数据）上限 2048，需 20M 的 hashmap。

预留 32M hashmap 足够，支持同时打开约 3200 个文件。

创建 dg 时，hashmap 按预设值创建，并控制当前节点 open 文件数。

### 5.5 间接 au 延迟加载（后续需求解决）

延迟加载间接 AU，仅当文件第一次 open 或 create 时加载间接 AU，未 open 的文件间接 AU 不加载。

close 时释放加载的间接 AU。

文件打开引用计数记录在本地节点中，无需通知主节点。

本地 yfs 服务还应限制客户端打开的文件数，避免 hashmap 满载。

### 5.6 新增命令

#### 5.6.1 show status

显示信息

SHM

|名称|说明|
|---|---|
|TOTAL|shm pool 大小|
|USED|已使用大小|
|FREE|空闲大小|
|MAX|最大值，如无，INFIN|
|AREAS|列出 area 数量，当前 area 大小和下一个 area 大小|


AU MAP

|名称|说明|
|---|---|
|SIZE|内存大小|
|CAPACITY|总容量|
|LOAD_FACTOR|负载系数，设计最大为 0.7|
|  
|  
|


sys_area 显示信息

|名称|说明|
|---|---|
|TOTAL|内存池大小|
|MAX|最大值，如无，INFIN|
|  
|  
|


示例：

```
YFSCMD &gt;  show status
Instance
--------------------
home: /home/mayong/YASDB_NODE/node0

Shm
--------------------
max  : 1.00GB   
total: 192.00MB 
used : 142.89MB 
free : 49.11MB  
areas: 2
  curr size: 128.00MB 
  next size: 256.00MB 

Mem
--------------------
max  : 32.00MB   
total: 1.00MB   
blocks:
  size : 64.00KB  
  count: 16

Hashmap
--------------------
DG: DG_0
  capacity: 524288
  max load: 367001
  used    : 200
DG: DG_1
  capacity: 524288
  max load: 367001
  used    : 0

```

  


#### 5.6.2 yfsminer 支持解析 shm.id 文件

显示信息

|名称|说明|
|---|---|
|  
|编号|
|id|shm id，与 ipcs -a 的 id 列一致|
|size|shm 大小|


示例：

```
[node0]$ yfsminer -m instance/shm.id 
0 : id = 65583, size = 64.00MB    [67108864]
1 : id = 65584, size = 128.00MB   [134217728]
SUCCESS

```

  


#### 5.6.3 yfscmd 在线更新参数

在线调整 SHM_POOL_SIZE 和 SYS_AREA_SIZE 配置，立刻生效。

约束：

1. 只能增大，不能缩小。
1. 更新参数值不小于默认值。
1. 不持久化，先改备后改主。


示例：

```
yfscmd exec "alter system set shm_pool_size = 10G"

yfscmd exec "alter system set sys_area_size = 100M"

```

  


### 5.7 兼容性

参数兼容，语义变化。

### 5.8 DFX 设计

## 6. Testcases（用例）

  


|测试场景|预期|
|---|---|
|参数测试|SHM_POOL_SIZE 配置 2G。,au size = 1， 单副本时，建立 10K 个大于 61 M 的文件，YFS 无报错。,yfscmd show status 可以看到每个文件至少消耗 1M shm，shm 自动扩展无问题。,yfsminer解析 shm.id 文件，记录的 id 与 ipcs -m  结果一致。,  
,SYS_AREA_SIZE 配置 64M。,创建 10K 个目录，show status 检查 mem 消耗，自动扩展大小。|
|在线更新配置|通过 yfscmd 指令修改 SHM_POOL_SIZE 和 SYS_AREA_SIZE ，解决内存不足的错误。|
|默认参数|注释 SHM_POOL_SIZE 和 SYS_AREA_SIZE ,YFS 正常启动，可以执行简单的 DB 建库等操作。|
|show status|显示 shm 消耗符合预期，shm 总量与 ipcs -m 一致。|
|创建大量超大文件|~~触发多级 hashmap 。（需要大量存储空间，可能不具备测试条件）~~   触发 hashmap 已满报错，但不能 core，文件删除后恢复正常。|
|  
|  
|
|  
|  
|
|  
|  
|


##   [7. 资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

yfscmd 新增 show status，显示 YFS 内存使用情况。

## 8. TODO（遗留问题）

  


## Attachments:

[image2023-11-10_18-29-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTE4OTcwYzJhZjRmNTIwYjIzIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.Y6pG2nBOKorEkafc3OplSLYJXzsIb-BPev1BV7Z7BbM)

 (image/png)    


[image2023-11-10_18-29-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTFhMWFkOWEzMzExZGM4OTkwIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.g4R5ABRlFhavWHWx743XURCm-Fhbz6hxxFKaGYXFFj4)

 (image/png)    


[image2023-10-31_16-34-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTE4OTcwYzJhZjRmNTIwYjI0IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.0ya5N8V-rYP2117myhLzkA-24gcDUquxx3IolceX5pE)

 (image/png)    


[image2023-10-30_15-55-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTFhMWFkOWEzMzExZGM4OTkxIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.R7WOYkctvTCKCobk1o2kdMW8HQTEKNvaxbhukA7B51o)

 (image/png)    


[image2023-10-30_15-54-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTFhMWFkOWEzMzExZGM4OTkyIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.bFARa_aissQ_8uLaGnVEFrasIh2l00d6RZ-ngr3yV08)

 (image/png)    


[image2023-10-24_16-2-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTFhMWFkOWEzMzExZGM4OTkzIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.YSsg8fMM4zgzpT4tGdkFV2n9CbgY8kXFzksf5NdEv5o)

 (image/png)    


[image2023-10-24_15-19-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTE4OTcwYzJhZjRmNTIwYjI1IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.8Av16i3ozjX_q0uq2qPu5tLgRzDWYg-MpR1P5oOcHFo)

 (image/png)    


[image2023-10-23_16-2-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTE4OTcwYzJhZjRmNTIwYjI2IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.hxaL46vEhEfsQkkDNhNQFCz-88IguGsTBW294-6RgAw)

 (image/png)    


[image2023-10-23_16-0-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTFhMWFkOWEzMzExZGM4OTk0IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.KifBpf8FbsrGZnxN_V9E9Hkgh3Lp13lAau76A1U1Y4o)

 (image/png)    


[image2023-10-23_11-45-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjI3IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.QDZRP9Dj03JQ5gdlioq76HMNNugVA_FJk8tvdec98uM)

 (image/png)    


[image2023-10-23_11-38-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTk1IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.oGlEfN_kYASqJfJ3TlmY-UJ2X1pWU2br2m4mlasJdBE)

 (image/png)    


[image2023-10-23_11-4-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTk2IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.Dv66ba6YtHHmONibm7yY4RpXou5kzmUInC-e1p9Luqg)

 (image/png)    


[image2023-10-19_18-32-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjI5IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.WLDX6waXwgfj5PLXu70QZOMuH6LhLIZhOpoQgNQGrN4)

 (image/png)    


[image2023-10-19_18-32-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTk4IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.oo3AjKgNeuToStBern7570U7MJkA8I52RamqNI-tyAY)

 (image/png)    


[image2023-10-19_18-31-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjJhIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9._Sl8k7KtVp5yqmdyW8NAeeo8v-_ONuopaFlQetaNKrk)

 (image/png)    


[image2023-10-19_18-30-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTk5IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.bGelZNSEBFwps4_zN376h4V0Rj7rfwOYOJT0BIN80Gw)

 (image/png)    


[image2023-10-19_18-26-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTlhIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.-R2pShHVWOe84XPmG2qLdaW-gQMr8RU5v9UjUAr4Y2Q)

 (image/png)    


[image2023-10-19_18-24-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjJiIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.wm1x6SDYGyi-kWgdp5tKcLIrPYFiXeZLhXGo_nG1ZX8)

 (image/png)    


[image2023-10-19_18-23-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjJjIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.sck6A71oaUHWGguYiE7_r8-I_s_ogS01a1Pvo8hz_Bw)

 (image/png)    


[image2023-10-19_18-21-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTliIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.6gV2IJsaHywJiusl5A952wSdeFQEM0SVmfrTDv6C1qk)

 (image/png)    


[image2023-10-19_18-21-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTljIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.Xt0DzrCN9j8ObIHiuXP_Qw5a6yJcMgA6Py_BSU-ebV8)

 (image/png)    


[image2023-10-19_18-21-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjJkIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.zJ8Ubuq_gR4KYYco-QW621vmiFmVGSFOIJvz8PHXL2o)

 (image/png)    


[image2023-10-19_18-20-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTJhMWFkOWEzMzExZGM4OTlkIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.vENk7AX-1TET7-ZsFQiQC9npxjA0x-s1P5f0WHyhADw)

 (image/png)    


[image2023-10-19_18-17-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjJlIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.3MZl8HgynY426-sTfNG-2-htDo0kStEkNAhfAnJlifE)

 (image/png)    


[image2023-10-19_18-15-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjJmIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.3f3AHdntRcUP2VnK-q_IrotRBwUFeACgPuMKAk3N4sw)

 (image/png)    


[image2023-10-19_18-14-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjMwIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.jGoZIk1L4Lw-lAwGGbpBMbyDkIng5cnKyaiOaMmti88)

 (image/png)    


[image2023-10-19_18-13-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjMxIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.smnkxgmACIyWE4QBqSrA2xlsUq6IGNWRLyiLhIJCHGk)

 (image/png)    


[image2023-10-17_16-23-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTI4OTcwYzJhZjRmNTIwYjMyIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.VBYqxewLWMiGhJA1co1O0XNbsxocNanA_Fld1x9Yurc)

 (image/png)    


[image2023-10-17_16-4-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTNhMWFkOWEzMzExZGM4OTllIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.hh5pJ7b6sQl6wd7fnjBANgaHwrPJsFnbG3HkHGJQqNc)

 (image/png)    


[image2023-10-17_14-31-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTNhMWFkOWEzMzExZGM4OTlmIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.0dJLa3gr4WRJx7ow6O1rvcLUiaBzczgIAwVG6526kP8)

 (image/png)    


[image2023-10-17_14-27-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTNhMWFkOWEzMzExZGM4OWEwIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.rN30uH4lRsIrnY1l7FEbq02U5tiRujxJV0CZUhzIR34)

 (image/png)    


[image2023-10-17_11-56-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTM4OTcwYzJhZjRmNTIwYjMzIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.fV1Cnak6wXKyEWgSRJ9U3LIcJk9WUcK9_SmM9X1w3Ro)

 (image/png)    


[image2023-12-1_11-58-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTNhMWFkOWEzMzExZGM4OWEyIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.GXE757SvsY1qPuDVwTqf0cPIkZZjfw0QfuzEGooQ-co)

 (image/png)    


[image2023-12-1_15-36-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTM4OTcwYzJhZjRmNTIwYjM1IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.EDtRImYhl9Y4R4NWyKRyvmC3-HVfEQ9QxqbXVB37lMs)

 (image/png)    


[image2023-12-1_15-48-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTM4OTcwYzJhZjRmNTIwYjM2IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.yhjYN2dQnSq0jPE8nO6TlqQwrB2RmgP1IItC8Octz9s)

 (image/png)    


[image2023-12-1_15-51-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTM4OTcwYzJhZjRmNTIwYjM3IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.PQ2KicZ2KF0WopWNqM3l1bllMujzlqmMZZqMdTpNIiI)

 (image/png)    


[image2023-12-1_15-52-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTNhMWFkOWEzMzExZGM4OWE0IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.S8HYmPIlnItYtCplpDYIYRy96J9kvDkROdwW8rJhyxc)

 (image/png)    


[image2023-12-1_17-6-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTM4OTcwYzJhZjRmNTIwYjM4IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.n1O0c6ymujb8jMe0eXSPXrWwd7iZOqI-A3VYwrJK8D8)

 (image/png)    


[image2023-12-6_16-40-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTM4OTcwYzJhZjRmNTIwYjM5IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.DZGPzxtxGZzKy8z_iINXfPLIggwIi0YCsWO2ypp3HKc)

 (image/png)    


[image2023-12-9_15-7-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTNhMWFkOWEzMzExZGM4OWE2IiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.Ph5DkmmsM9NwGbLxDHEF396VA78PAAc7Zt4jLw3IH8E)

 (image/png)    


[image2023-12-9_15-17-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNTQ4OTcwYzJhZjRmNTIwYjNhIiwicmVmX2lkIjoiNjczOTZjNTE1OTNmOTljOWZmMjM2ZDJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMzQ2LCJleHAiOjE3ODIzODY3NDZ9.nQ5igb33jIi3xmCkK5WJZJwUEEo2TQKSY2j0INFjBww)

 (image/png)    


## Comments:

|  [](null)  ,共享内存不足引起的原因：可能系统不足，或配置太小，错误码应分开。,Posted by mayong at 十二月 05, 2023 10:21|
|---|
|  [](null)  ,会议纪要,时间： 2023-12-12 10:00 技术方案评审（测试方案评审延后）,参与人员：马志虹，朱国旭，张彩虹，高风朴，马勇,会议地点： 线上会议,评审意见：,1. shm 和 sys area 不能无限增长。【SHM_POOL_SIZE 和 SYS_AREA_SIZE 就是上限，实际消耗量随着业务运行提升】
1. 注意文档说明，应先备机后主机调整参数，否则会 core。
1. 重点注意创建 61M 的文件，快速消耗 shm pool，通过 yfscmd show status 检查 shm 消耗符合预期。
1. hash表和 au 延迟加载延后在后续需求处理，暂不开发。
,评审结果： 通过,Posted by mayong at 十二月 12, 2023 17:36|

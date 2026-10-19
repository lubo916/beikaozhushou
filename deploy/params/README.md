# deploy/params

预发与生产的参数覆盖文件放在这里，随 api 与 worker 的镜像一起发布（deploy/Dockerfile 复制整个仓库）。
读取方式与文件格式由 PLAT-02 规定；参数登记见 contracts/params.yaml。本目录不放任何秘密。

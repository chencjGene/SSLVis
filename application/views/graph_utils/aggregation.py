from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import numpy as np


class Aggregation:
    def __init__(self):
        self.labels = None
        self.centers = None
        self.k = 0


    def reset_labels(self, labels):
        assert self.k == 10
        label_cnt = np.zeros((self.k, self.k))
        for i, label in enumerate(self.labels):
            label_cnt[label][labels[i]] += 1
        true_label = [i for i in range(self.k)]
        for i in range(self.k):
            true_label[i] = int(np.argmax(label_cnt[i]))
        for i in range(len(self.labels)):
            self.labels[i] = true_label[self.labels[i]]

    def aggregate(self, x, k):
        self.k = k
        # pca = PCA(n_components=128)
        # x = pca.fit_transform(x)
        kmeans = KMeans(n_clusters=k, random_state=1).fit(x)
        self.labels = kmeans.labels_
        self.centers = kmeans.cluster_centers_
        return kmeans